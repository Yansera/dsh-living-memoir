/**
 * 记忆册 host 端集成自测：用 mock 宿主跑通「注册 → 工具 → 注入 → HTTP 路由」，
 * 不需要启动 DSH，也不碰任何真实 profile。
 *   node test-plugin.mjs
 */
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { apply, API_PREFIX } from "../src/index.js";

let failures = 0;
const check = (label, condition, extra) => {
  if (condition) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.log(`  FAIL ${label}${extra === undefined ? "" : ` — ${JSON.stringify(extra)}`}`);
  }
};

const dir = mkdtempSync(join(tmpdir(), "memoir-plugin-"));
const seen = { tools: [], sections: [], routes: [], effects: 0, events: [] };
const ctx = {
  logger: { info() {}, warn: (...args) => console.warn("  [warn]", ...args) },
  tools: { register: (tool) => (seen.tools.push(tool), () => {}) },
  systemPrompt: { section: (section) => (seen.sections.push(section), () => {}) },
  webServer: { register: (route) => (seen.routes.push(route), () => {}) },
  on: (event, handler) => {
    seen.events.push(event);
    return () => {};
  },
  get: () => undefined,
  effect: (fn) => {
    seen.effects += 1;
    return fn();
  },
};

apply(ctx, { memoryDir: dir, injectIndex: true, maxInjectEntries: 12 });

// ── 注册面 ────────────────────────────────────────────────────────────────
check("注册了 3 个模型工具", seen.tools.length === 3, seen.tools.map((t) => t.name));
check(
  "工具名符合预期",
  seen.tools.map((t) => t.name).join(",") === "memoir_note,memoir_recall,memoir_forget",
  seen.tools.map((t) => t.name)
);
check("注册了 1 个系统提示 section", seen.sections.length === 1 && seen.sections[0].name === "memoir:index");
check("注册了 4 条路由", seen.routes.length === 4, seen.routes.map((r) => r.path));
check("每条注册都走 ctx.effect", seen.effects === 6, seen.effects);
check("挂上了会话事件钩子（自动提炼）", seen.events.includes("session/event"), seen.events);

const byName = Object.fromEntries(seen.tools.map((t) => [t.name, t]));
check("工具带 model-facing JSON Schema", byName.memoir_note.parameters.type === "object", byName.memoir_note.parameters);
check(
  "分类参数是自由字符串（分类由模型自己维护，不再是写死的枚举）",
  byName.memoir_note.parameters.properties.category.type === "string" &&
    byName.memoir_note.parameters.properties.category.enum === undefined,
  byName.memoir_note.parameters.properties.category
);
check(
  "note 工具带可选的分类中文名",
  byName.memoir_note.parameters.properties.category_title?.type === "string",
  byName.memoir_note.parameters.properties.category_title
);
check("必填项被标进 required", byName.memoir_note.parameters.required.includes("category") && byName.memoir_note.parameters.required.includes("text"), byName.memoir_note.parameters.required);

// ── 工具执行 ──────────────────────────────────────────────────────────────
const noteResult = await byName.memoir_note.execute(
  { category: "user", text: "主人要求回复用简体中文", importance: 5, source: "主人明确说" },
  {}
);
check("memoir_note 落盘成功", noteResult.action === "added" && noteResult.category === "user", noteResult);
check("note 的 render 输出可读文本", /记忆册/.test(byName.memoir_note.output.render({}, noteResult)[0].text));

const recallResult = await byName.memoir_recall.execute({ query: "简体中文" }, {});
check("memoir_recall 搜到刚写的", recallResult.total === 1 && recallResult.text.includes("简体中文"), recallResult);
check("recall 文本带 id", /id=/.test(recallResult.text), recallResult.text);

const idxText = seen.sections[0].text({});
check("注入文本包含刚写的记忆", idxText.includes("简体中文"), idxText);
check("注入文本包含用法引导", idxText.includes("memoir_note"), idxText);

const forgetResult = await byName.memoir_forget.execute({ id: noteResult.id }, {});
check("memoir_forget 删掉了", forgetResult.removed === true, forgetResult);
check("删掉后注入变空", seen.sections[0].text({}) === "", seen.sections[0].text({}));

// ── HTTP 路由（起真 server 打真请求）──────────────────────────────────────
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  for (const route of seen.routes) {
    const hit = route.kind === "exact"
      ? url.pathname === route.path
      : url.pathname === route.path || url.pathname.startsWith(`${route.path}/`);
    if (hit) {
      void route.handler(req, res);
      return;
    }
  }
  res.writeHead(404).end();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const getJson = async (path, options) => {
  const res = await fetch(base + path, options);
  return { status: res.status, body: await res.json() };
};

let r = await getJson(`${API_PREFIX}/state`);
check("GET /state 返回 200", r.status === 200, r);
check("GET /state 带记忆库目录", typeof r.body.dir === "string" && r.body.dir.length > 0, r.body.dir);
check("GET /state 返回 6 个分类", r.body.categories.length === 6, r.body.categories.length);
check("分类带标题与提示", Boolean(r.body.categories[0].title && r.body.categories[0].hint));
check(
  "GET /state 带运行时自述（重启后靠它辨认客户端加载的是哪一版）",
  Boolean(r.body.runtime?.capabilities?.includes("distiller")) && typeof r.body.runtime.version === "string",
  r.body.runtime
);

r = await getJson(`${API_PREFIX}/entry`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ category: "lessons", text: "页面写入的记忆", importance: 4 }),
});
check("POST /entry 新建成功", r.status === 200 && r.body.action === "added", r);
const createdId = r.body.entry.id;

r = await getJson(`${API_PREFIX}/entry`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ id: createdId, text: "页面改过的记忆", importance: 2 }),
});
check("PATCH /entry 改成功", r.status === 200 && r.body.entry.text === "页面改过的记忆", r);
check("PATCH 改掉了重要度", r.body.entry.importance === 2, r.body.entry);

r = await getJson(`${API_PREFIX}/entry`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ id: "does-not-exist", text: "x" }),
});
check("PATCH 不存在的 id 返回 404", r.status === 404, r);

r = await getJson(`${API_PREFIX}/entry?id=${encodeURIComponent(createdId)}`, { method: "DELETE" });
check("DELETE /entry 删成功", r.status === 200 && r.body.removed === true, r);

r = await getJson(`${API_PREFIX}/entry?id=nope`, { method: "DELETE" });
check("DELETE 不存在的 id 返回 404", r.status === 404, r);

r = await getJson(`${API_PREFIX}/entry`, { method: "GET" });
check("不支持的方法返回 405", r.status === 405, r);

r = await getJson(`${API_PREFIX}/unknown-thing`);
check("未知子路径 404", r.status === 404 && r.body.error === "not-found", r);

r = await getJson(`${API_PREFIX}/entry`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ category: "Not A Category!", text: "x" }),
});
check("形状非法的分类被拒（分类自由，但它同时得是合法文件名）", r.status >= 400, r);

r = await getJson(`${API_PREFIX}/entry`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ category: "brand-new", text: "新分类会自动建出来", category_title: "新分类" }),
});
check("新分类会被自动创建", r.status === 200 && r.body?.entry?.category === "brand-new", r);

r = await getJson(`${API_PREFIX}/state`);
const brandNew = r.body.categories.find((category) => category.id === "brand-new");
check("新分类出现在 /state 里", Boolean(brandNew), r.body.categories.map((c) => c.id));
check("新分类带上了中文名", brandNew?.title === "新分类", brandNew);

// ── 设置面板：写入总开关 + 模型定制 ────────────────────────────────────────
r = await getJson(`${API_PREFIX}/settings`, { method: "GET" });
check("GET /settings 返回 200", r.status === 200, r);
check("默认是开着的", r.body.effective.enabled !== false, r.body.effective);

r = await getJson(`${API_PREFIX}/settings`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ distillProvider: "local-llama", distillModel: "qwen3-8b", distillReasoningEffort: "low" }),
});
check("PATCH /settings 存下模型定制", r.status === 200 && r.body.settings.distillModel === "qwen3-8b", r);
check("生效配置读得到定制 provider", r.body.effective.distillProvider === "local-llama", r.body.effective);
check("思考程度也存下来了", r.body.effective.distillReasoningEffort === "low", r.body.effective);

r = await getJson(`${API_PREFIX}/settings`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ enabled: false, injectIndex: true, autoDistill: true }),
});
check("关掉总开关成功", r.status === 200 && r.body.effective.enabled === false, r);
check("关掉总开关 → 注入被强制停掉（哪怕配置里写着 true）", r.body.effective.injectIndex === false, r.body.effective);
check("关掉总开关 → 改写被强制停掉（哪怕配置里写着 true）", r.body.effective.autoDistill === false, r.body.effective);

r = await getJson(`${API_PREFIX}/state`);
check("关掉后 /state 也报 enabled=false", r.body.effective.enabled === false, r.body.effective);

r = await getJson(`${API_PREFIX}/entry`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ category: "lessons", text: "关掉之后不该被写进去", importance: 3 }),
});
check("关掉后页面写入被拒（不是 200）", r.status >= 400, r);
check("关掉后确实没写进去", !r.body?.entry, r.body);

r = await getJson(`${API_PREFIX}/settings`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ enabled: true }),
});
check("重新打开总开关", r.status === 200 && r.body.effective.enabled === true, r.body.effective);
check("打开后注入回到配置里的值", r.body.effective.injectIndex !== false, r.body.effective);

await new Promise((resolve) => server.close(resolve));
rmSync(dir, { recursive: true, force: true });
console.log(failures === 0 ? "\n全部通过" : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
