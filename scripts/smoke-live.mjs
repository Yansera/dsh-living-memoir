/**
 * 对**运行中的客户端**做一轮真实端到端冒烟：读 → 增 → 改 → 删 → 再读。
 *
 * 走的是页面半将来用的同一条 HTTP 通道，能验到 mock 测试验不到的东西：
 * 真实 HTTP 层、真实中文编码、真实进程里的插件版本。测试数据用完即删。
 *
 *   node smoke-live.mjs [baseUrl]
 *
 * 默认打 http://127.0.0.1:19387（桌面客户端）。插件路由不需要 GUI 的 token，
 * 只有首页 `/` 需要——所以这个脚本可以直接跑。
 */
const host = process.argv[2] ?? "http://127.0.0.1:19387";
const API = `${host}/api/dsh-memoir`;

let failures = 0;
const check = (label, condition, extra) => {
  if (condition) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.log(`  FAIL ${label}${extra === undefined ? "" : ` — ${JSON.stringify(extra)?.slice(0, 300)}`}`);
  }
};

const json = async (path, options) => {
  const res = await fetch(API + path, options);
  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
};
const postJson = (path, payload, method = "POST") =>
  json(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
const findEntry = (state, id) => state.categories.flatMap((c) => c.entries).find((e) => e.id === id);

console.log(`目标：${API}\n`);

// ── 连通性与版本 ──────────────────────────────────────────────────────────
let state;
try {
  const res = await json("/state");
  state = res.body;
  check("GET /state 可达", res.status === 200, res.status);
} catch (error) {
  console.log(`\n连不上：${String(error.message)}`);
  console.log("桌面客户端没在跑？或者端口不是 19387。");
  process.exit(2);
}

const before = state.categories.reduce((n, c) => n + c.entries.length, 0);
console.log(`  记忆库：${state.dir}`);
console.log(`  现有 ${before} 条记忆`);
if (state.runtime) {
  console.log(`  插件版本：${state.runtime.version}  能力：${state.runtime.capabilities.join(", ")}`);
  console.log("  ==> 客户端已加载【新代码】");
} else {
  console.log("  插件版本：（/state 没有 runtime 字段）==> 客户端仍在跑【旧代码】，需要重启客户端");
}

// ── 新增（中文，验证真实编码）────────────────────────────────────────────
const marker = `冒烟测试_${Date.now()}`;
const created = await postJson("/entry", { category: "self", text: `这是冒烟测试条目 ${marker}`, importance: 2 });
check("POST /entry 建成功", created.status === 200 && created.body?.entry?.id, created);
const id = created.body?.entry?.id;

let after = await json("/state");
const found = findEntry(after.body, id);
check("新增的条目能在 /state 里读到", Boolean(found), id);
check("中文原样往返，没有乱码", found?.text === `这是冒烟测试条目 ${marker}`, found?.text);
check("重要度写对了", found?.importance === 2, found?.importance);
check("来源标成「页面」", found?.source === "页面", found?.source);

// ── 修改 ──────────────────────────────────────────────────────────────────
const patched = await postJson("/entry", { id, text: `改过的冒烟测试条目 ${marker}`, importance: 5 }, "PATCH");
check("PATCH /entry 改成功", patched.status === 200 && patched.body?.entry?.text.includes("改过的"), patched);
after = await json("/state");
const patchedEntry = findEntry(after.body, id);
check("改动落盘了", patchedEntry?.text === `改过的冒烟测试条目 ${marker}`, patchedEntry?.text);
check("重要度也改了", patchedEntry?.importance === 5, patchedEntry?.importance);

// ── 边界 ──────────────────────────────────────────────────────────────────
const badCategory = await postJson("/entry", { category: "not-a-category", text: "x" });
check("非法分类被拒（4xx，不是 500）", badCategory.status >= 400 && badCategory.status < 500, badCategory.status);

const tooLong = await postJson("/entry", { category: "self", text: "长".repeat(1000) });
check("超长正文被截到 400 字", tooLong.body?.entry?.text?.length === 400, tooLong.body?.entry?.text?.length);
if (tooLong.body?.entry?.id) {
  await json(`/entry?id=${encodeURIComponent(tooLong.body.entry.id)}`, { method: "DELETE" });
}

const missing = await postJson("/entry", { id: "nope-nope", text: "x" }, "PATCH");
check("改不存在的条目返回 404", missing.status === 404, missing.status);

// ── 删除与清理 ────────────────────────────────────────────────────────────
const removed = await json(`/entry?id=${encodeURIComponent(id)}`, { method: "DELETE" });
check("DELETE /entry 删成功", removed.status === 200 && removed.body?.removed === true, removed);
after = await json("/state");
check("删掉的条目真的没了", findEntry(after.body, id) === undefined, id);

const final = after.body.categories.reduce((n, c) => n + c.entries.length, 0);
check("记忆条数回到测试前", final === before, { before, final });

console.log(failures === 0 ? "\n全部通过" : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
