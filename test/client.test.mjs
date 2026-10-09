/**
 * 记忆册 页面半 自测：在 Node 里搭一个极小的 React + DOM 替身，把 client.js
 * 当真实 bundle 加载，然后渲染组件、模拟点击、断言真的发出了正确的请求。
 *   node test-client.mjs
 *
 * 覆盖：bundle 结构、导出的 apply/inject、插槽注册参数、CSS 注入、入口按钮、
 * 面板「加载态 → 数据态」渲染、新建 / 编辑 / 删除三条写路径、错误态。
 */
import { readFileSync } from "node:fs";

let failures = 0;
const check = (label, condition, extra) => {
  if (condition) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.log(`  FAIL ${label}${extra === undefined ? "" : ` — ${JSON.stringify(extra)?.slice(0, 300)}`}`);
  }
};

// ── 极简 React 替身 ────────────────────────────────────────────────────────
let hookStates = [];
let hookIndex = 0;
let dirty = false;
let effects = [];
const react = {
  Fragment: Symbol("Fragment"),
  createElement(type, props, ...children) {
    return {
      type,
      props: props || {},
      children: children.flat().filter((c) => c !== null && c !== undefined && c !== false),
    };
  },
  useState(init) {
    const i = hookIndex++;
    if (!(i in hookStates)) hookStates[i] = typeof init === "function" ? init() : init;
    return [
      hookStates[i],
      (next) => {
        hookStates[i] = typeof next === "function" ? next(hookStates[i]) : next;
        dirty = true;
      },
    ];
  },
  useEffect(fn) {
    effects.push(fn);
  },
  useCallback(fn) {
    return fn;
  },
};

/**
 * 把元素树展开成宿主元素树：函数组件被调用，Fragment 透明。
 * `maxDepth` 限制展开层数——1 表示只展开最外层组件，它里面渲染的组件保持为元素。
 */
function expand(node, depth, maxDepth) {
  if (Array.isArray(node)) return node.flatMap((n) => [expand(n, depth, maxDepth)]);
  if (!node || typeof node !== "object") return node;
  const children = node.children || [];
  if (typeof node.type === "function" && depth < maxDepth) {
    if (node.type === react.Fragment) {
      return { type: node.type, props: node.props, children: children.flatMap((c) => [expand(c, depth, maxDepth)]) };
    }
    const rendered = node.type({ ...node.props, children: children.length === 1 ? children[0] : children });
    return expand(rendered, depth + 1, maxDepth);
  }
  return { type: node.type, props: node.props, children: children.flatMap((c) => [expand(c, depth, maxDepth)]) };
}

/** 渲染到稳定：反复跑到没有 setState 触发为止。 */
function render(Component, props, { maxDepth = Infinity, passes = 6 } = {}) {
  let tree = null;
  for (let pass = 0; pass < passes; pass++) {
    hookIndex = 0;
    dirty = false;
    effects = [];
    tree = expand(react.createElement(Component, props), 0, maxDepth);
    for (const fn of effects) {
      const cleanup = fn();
      if (typeof cleanup === "function") cleanup();
    }
    if (!dirty) return tree;
  }
  return tree;
}

/** 让挂起的 promise 回调跑完。 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function walk(node, visit) {
  if (node === null || node === undefined || node === false) return;
  visit(node);
  if (typeof node !== "object") return;
  for (const child of node.children || []) walk(child, visit);
}

function findAll(tree, predicate) {
  const hits = [];
  walk(tree, (node) => {
    if (node.type !== undefined && predicate(node)) hits.push(node);
  });
  return hits;
}

function textOf(tree) {
  const parts = [];
  walk(tree, (node) => {
    if (typeof node === "string" || typeof node === "number") parts.push(String(node));
    if (typeof node.props?.children === "string") parts.push(node.props.children);
  });
  return parts.join(" | ");
}

const byText = (tree, type, needle) => findAll(tree, (n) => n.type === type && String(n.children).includes(needle))[0];
const byTitle = (tree, title) => findAll(tree, (n) => n.props.title === title)[0];

// ── DOM / fetch 替身 ──────────────────────────────────────────────────────
const fetchCalls = [];
let fetchResponder = () => ({ dir: "", categories: [] });
const styleTags = [];

globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      globalThis.window.__loaded = definition;
    },
  },
  __DSH_MEMOIR_TEST__: {},
};
globalThis.document = {
  addEventListener() {},
  removeEventListener() {},
  querySelector: () => null,
  createElement: (tag) => ({ tag, dataset: {}, style: {}, textContent: "" }),
  head: { appendChild: (el) => styleTags.push(el) },
  body: { appendChild() {} },
};
globalThis.fetch = async (url, options) => {
  fetchCalls.push({ url, method: (options && options.method) || "GET", body: options && options.body });
  const body = fetchResponder(url, options);
  if (body instanceof Error) throw body;
  return { ok: true, status: 200, json: async () => body };
};

// ── 加载真实 bundle ───────────────────────────────────────────────────────
const code = readFileSync(new URL("../src/client.js", import.meta.url), "utf8");
check("client.js 是 ModuleLoader bundle（无构建步骤）", code.includes("window.__ModuleLoader__.load"));
new Function(code)();

const loaded = globalThis.window.__loaded;
check("bundle 声明的 id 与包名一致（client-modules 靠它注册 factory）", Boolean(loaded) && loaded.id === "@yansera/dsh-living-memoir", loaded && loaded.id);

const required = [];
const mod = loaded.factory((name) => {
  required.push(name);
  if (name === "react") return react;
  throw new Error(`unexpected require: ${name}`);
});
check("CSS 被注入成 style 标签", styleTags.length === 1 && styleTags[0].textContent.includes("__mm_panel"), styleTags.length);
check("factory 只 require react", required.join(",") === "react", required);
check("导出 apply 函数", typeof mod.apply === "function");
check("导出 inject 数组", Array.isArray(mod.inject) && mod.inject.join(",") === "slots,locale,layout", mod.inject);

const internals = globalThis.window.__DSH_MEMOIR_TEST__.internals;
check("自测钩子暴露了组件", Boolean(internals && internals.MemoirEntry && internals.MemoirPanel));

// ── apply：插槽注册 ───────────────────────────────────────────────────────
const registered = { slots: [], effects: 0, locales: null };
const layoutCalls = [];
const t = (key) => `T:${key}`;
const ctx = {
  logger: { info() {}, warn() {} },
  locale: {
    bind: () => t,
    register: (ns, dicts) => {
      registered.locales = { ns, dicts };
      return () => {};
    },
  },
  slots: {
    // 真实的 slots.inject 接受生成器（一次注入多个注册），这里也要摊平，
    // 否则测试拿到的是生成器对象、断言会全部落空。
    inject: (name, factory) => {
      const out = factory();
      const entries = out && typeof out.next === "function" ? [...out] : [out];
      registered.slots.push({ name, entries });
      return () => {};
    },
    register: (spec, component) => ({ spec, component }),
  },
  // 整页模式的出口：ctx.layout.selectPanel(null) 回到会话界面
  layout: { selectPanel: (id) => layoutCalls.push(id) },
  effect: (fn) => {
    registered.effects += 1;
    return fn();
  },
};
mod.apply(ctx);
check("注册了 memoir 命名空间的语言包", Boolean(registered.locales) && registered.locales.ns === "memoir", registered.locales?.ns);
const LANGS = ["zh", "en", "fr", "de", "ja"];
const dicts = registered.locales?.dicts ?? {};
check("五种语言都注册了", LANGS.every((l) => Boolean(dicts[l])), Object.keys(dicts));
// 缺键会静默回落到宿主语言，界面上会突然冒出另一种语言——所以键必须逐一对齐。
for (const lang of LANGS.slice(1)) {
  const missing = Object.keys(dicts.zh ?? {}).filter((k) => !(k in (dicts[lang] ?? {})));
  const extra = Object.keys(dicts[lang] ?? {}).filter((k) => !(k in (dicts.zh ?? {})));
  check(`${lang} 的键与 zh 完全一致（缺 ${missing.length} / 多 ${extra.length}）`, missing.length === 0 && extra.length === 0, { missing, extra });
}
check("字典不是空的", Object.keys(dicts.zh ?? {}).length > 15, Object.keys(dicts.zh ?? {}).length);
check(
  "设置面板的文案键齐全",
  ["settings", "enabled", "enabledHint", "modelSection", "provider", "model", "effort", "language", "langAuto"].every((k) => k in (dicts.zh ?? {})),
  Object.keys(dicts.zh ?? {})
);
check("语言包走 ctx.effect", registered.effects === 1, registered.effects);

const bySlot = Object.fromEntries(registered.slots.map((s) => [s.name, s.entries]));
check(
  "注册了三个插槽：main + sidebar.panellist + sidebar.footer.action",
  registered.slots.length === 3 && Boolean(bySlot.main && bySlot["sidebar.panellist"] && bySlot["sidebar.footer.action"]),
  registered.slots.map((s) => s.name)
);

// main：主区域的整页
const mainSpec = bySlot.main?.[0]?.spec;
check("main 注册带 key", mainSpec?.key === "memoir", mainSpec);
const MainPanelComponent = bySlot.main?.[0]?.component;
const mainProps = MainPanelComponent?.({})?.props;
check("main 组件把 variant=page 传进面板", mainProps?.variant === "page", mainProps);
check("main 组件带「返回对话」的出口回调", typeof mainProps?.onExit === "function", mainProps);

// sidebar.panellist：侧边栏的「全局面板」图标
const glyphSpec = bySlot["sidebar.panellist"]?.[0]?.spec;
check("panellist 的 id 与 main 的 key 一致（点击图标才切得过去）", glyphSpec?.id === "memoir" && glyphSpec.id === mainSpec?.key, glyphSpec);
check("panellist 带 label 函数", typeof glyphSpec?.label === "function" && glyphSpec.label() === "T:nav");
check("panellist 带排序值", glyphSpec?.order === 50, glyphSpec?.order);
const glyphNode = bySlot["sidebar.panellist"]?.[0]?.component({ size: 18 });
check("panellist 图标按 size 渲染", glyphNode?.props?.size === 18, glyphNode?.props);

// sidebar.footer.action：保底入口
const entrySpec = bySlot["sidebar.footer.action"]?.[0]?.spec;
check("footer 入口带 id", entrySpec?.id === "dsh-memoir", entrySpec);
check("footer 入口带 label 函数", typeof entrySpec?.label === "function" && entrySpec.label() === "T:nav");
check("footer 入口带排序值", entrySpec?.order === 20, entrySpec?.order);
const wrapped = bySlot["sidebar.footer.action"]?.[0]?.component({ wide: true });
check("入口组件把 wide 传进去", wrapped?.props?.wide === true && wrapped.props.t === t, wrapped?.props);

// ── 入口按钮 ──────────────────────────────────────────────────────────────
hookStates = [];
const entryTree = render(internals.MemoirEntry, { wide: true, t });
check("入口渲染出一个按钮", findAll(entryTree, (n) => n.type === "button").length === 1);
check("展开态带文字标签", textOf(entryTree).includes("T:nav"), textOf(entryTree).slice(0, 120));
check("未点击时不渲染面板", findAll(entryTree, (n) => n.type === internals.MemoirPanel).length === 0);

hookStates = [];
const closedEntry = render(internals.MemoirEntry, { wide: false, t });
check("收起态不带文字标签", !textOf(closedEntry).includes("T:nav"), textOf(closedEntry).slice(0, 120));

// 点击入口 → 面板出现（面板本身不展开，避免与面板自身测试混用 hook 槽）
hookStates = [];
const beforeClick = render(internals.MemoirEntry, { wide: true, t });
byText(beforeClick, "button", "").props.onClick?.();
const afterClick = render(internals.MemoirEntry, { wide: true, t }, { maxDepth: 1 });
check("点击入口后面板挂上", findAll(afterClick, (n) => n.type === internals.MemoirPanel).length === 1);

// ── 面板：加载态 → 数据态 ─────────────────────────────────────────────────
const Panel = internals.MemoirPanel;
const categoryFixture = () => [
  { id: "user", title: "关于主人", hint: "身份、环境", entries: [{ id: "u1", text: "称呼只能用「主人」", importance: 5, updatedAt: "2026-10-06", source: "主人明确说" }] },
  { id: "lessons", title: "踩过的坑", hint: "症状 → 原因", entries: [{ id: "l1", text: "硬链接会断", importance: 3, updatedAt: "2026-10-06", source: "页面" }] },
];

hookStates = [];
fetchCalls.length = 0;
fetchResponder = () => ({ dir: "D:\\dsh\\memoir", categories: categoryFixture() });

const first = render(Panel, { t, onClose: () => {} });
check("面板拉取了 /state", fetchCalls.some((c) => c.url === "/api/dsh-memoir/state"), fetchCalls.map((c) => c.url));
check("首帧是加载态", textOf(first).includes("T:loading"), textOf(first).slice(0, 120));

await settle();
const hydrated = render(Panel, { t, onClose: () => {} });
const hydratedText = textOf(hydrated);
check("顶栏显示记忆库目录", hydratedText.includes("D:\\dsh\\memoir"), hydratedText.slice(0, 200));
check("左侧列出分类", hydratedText.includes("关于主人") && hydratedText.includes("踩过的坑"), hydratedText.slice(0, 300));
check("渲染出条目正文", hydratedText.includes("称呼只能用「主人」"), hydratedText.slice(0, 300));
check("条目显示重要度星级", hydratedText.includes("★★★★★"), hydratedText.slice(0, 300));
check("条目显示日期与来源", hydratedText.includes("2026-10-06") && hydratedText.includes("主人明确说"));
check("遮罩层是对话框语义", findAll(hydrated, (n) => n.props.role === "dialog").length === 1);

// ── 默认落在「全部」视图 ──────────────────────────────────────────────────
check("默认视图是「全部」", hydratedText.includes("T:all"), hydratedText.slice(0, 160));
check("全部视图同时摊开两个分类的条目", hydratedText.includes("称呼只能用「主人」") && hydratedText.includes("硬链接会断"));
const tagCount = findAll(hydrated, (n) => String(n.props.className).includes("__mm_catTag")).length;
check("全部视图给每条标出分类名", tagCount === 2, tagCount);
check("全部视图不显示新增表单", !byText(hydrated, "button", "T:add"), "不该有新增按钮");
check("全部视图给出引导文案", hydratedText.includes("T:allHint"), hydratedText.slice(0, 200));



// 切到「关于主人」，后面所有写操作都在这个分类里做
const byLabel = (tree, label) =>
  findAll(tree, (n) => n.type === "button" && textOf({ type: "x", props: {}, children: n.children }).includes(label))[0];
byLabel(hydrated, "关于主人").props.onClick();
const inUser = render(Panel, { t, onClose: () => {} });
const inUserText = textOf(inUser);
check("切到单个分类后只剩该分类条目", inUserText.includes("称呼只能用「主人」") && !inUserText.includes("硬链接会断"), inUserText.slice(0, 200));
check("单个分类下重新出现新增入口", Boolean(byText(inUser, "button", "T:add")), inUserText.slice(0, 200));

// ── 交互：新建 ────────────────────────────────────────────────────────────
fetchCalls.length = 0;
const addBtn = byText(inUser, "button", "T:add");
check("找得到「记一条」按钮", Boolean(addBtn), inUserText.slice(0, 300));
addBtn.props.onClick();
const withDraft = render(Panel, { t, onClose: () => {} });
const textareas = findAll(withDraft, (n) => n.type === "textarea");
check("点开后出现输入框", textareas.length === 1, textareas.length);
check("输入框带占位提示", textareas[0].props.placeholder === "T:placeholder", textareas[0].props);

textareas[0].props.onChange({ target: { value: "新的记忆" } });
const withText = render(Panel, { t, onClose: () => {} });
const saveBtn = byText(withText, "button", "T:save");
check("找得到保存按钮", Boolean(saveBtn));
check("有正文时保存按钮可用", saveBtn.props.disabled === false, saveBtn.props.disabled);
saveBtn.props.onClick();
check(
  "保存发出了 POST /entry 且带正文",
  fetchCalls.some((c) => c.url === "/api/dsh-memoir/entry" && c.method === "POST" && String(c.body).includes("新的记忆")),
  fetchCalls
);
await settle();

// 空正文时保存按钮禁用
hookStates = [];
render(Panel, { t, onClose: () => {} });
await settle();
const hydratedEmpty = render(Panel, { t, onClose: () => {} });
byLabel(hydratedEmpty, "关于主人").props.onClick();
const inUserEmpty = render(Panel, { t, onClose: () => {} });
byText(inUserEmpty, "button", "T:add").props.onClick();
const emptyDraft = render(Panel, { t, onClose: () => {} });
check("空正文时保存按钮禁用", byText(emptyDraft, "button", "T:save").props.disabled === true);

// ── 交互：编辑 ────────────────────────────────────────────────────────────
hookStates = [];
fetchCalls.length = 0;
render(Panel, { t, onClose: () => {} });
await settle();
const hydrated2 = render(Panel, { t, onClose: () => {} });
const editBtn = byTitle(hydrated2, "T:edit");
check("条目带编辑按钮", Boolean(editBtn), textOf(hydrated2).slice(0, 200));
editBtn.props.onClick();
const editBox = findAll(render(Panel, { t, onClose: () => {} }), (n) => n.type === "textarea")[0];
check("编辑态出现输入框", Boolean(editBox), "no textarea");
check("编辑框预填原文", editBox.props.value === "称呼只能用「主人」", editBox.props.value);
editBox.props.onChange({ target: { value: "改过的内容" } });
const saveBtn2 = byText(render(Panel, { t, onClose: () => {} }), "button", "T:save");
saveBtn2.props.onClick();
check(
  "保存发出了 PATCH /entry 且带 id 与正文",
  fetchCalls.some(
    (c) => c.url === "/api/dsh-memoir/entry" && c.method === "PATCH" && String(c.body).includes("改过的内容") && String(c.body).includes("u1")
  ),
  fetchCalls
);
await settle();

// ── 交互：删除 ────────────────────────────────────────────────────────────
globalThis.window.confirm = () => true;
hookStates = [];
fetchCalls.length = 0;
render(Panel, { t, onClose: () => {} });
await settle();
const hydrated3 = render(Panel, { t, onClose: () => {} });
const delBtn = byTitle(hydrated3, "T:remove");
check("条目带删除按钮", Boolean(delBtn));
delBtn.props.onClick();
check(
  "确认后发出 DELETE /entry?id=",
  fetchCalls.some((c) => c.method === "DELETE" && c.url.startsWith("/api/dsh-memoir/entry?id=")),
  fetchCalls
);
await settle();

globalThis.window.confirm = () => false;
fetchCalls.length = 0;
byTitle(render(Panel, { t, onClose: () => {} }), "T:remove").props.onClick();
check("取消确认框时不发删除请求", !fetchCalls.some((c) => c.method === "DELETE"), fetchCalls);

// ── 交互：切分类 ──────────────────────────────────────────────────────────
hookStates = [];
render(Panel, { t, onClose: () => {} });
await settle();
const hydrated4 = render(Panel, { t, onClose: () => {} });
const lessonTab = findAll(hydrated4, (n) => n.type === "button" && textOf({ type: "x", props: {}, children: n.children }).includes("踩过的坑"))[0];
check("左侧分类可点击", Boolean(lessonTab));
lessonTab.props.onClick();
const switched = render(Panel, { t, onClose: () => {} });
const switchedText = textOf(switched);
check("切换后显示该分类的条目", switchedText.includes("硬链接会断"), switchedText.slice(0, 300));
check("切换后不再显示原分类条目", !switchedText.includes("称呼只能用「主人」"), switchedText.slice(0, 300));

// ── 交互：关闭 ────────────────────────────────────────────────────────────
const closeCalls = { n: 0 };
const closeBtn = byTitle(render(Panel, { t, onClose: () => (closeCalls.n += 1) }), "T:close");
check("关闭按钮存在", Boolean(closeBtn));
closeBtn.props.onClick();
check("关闭按钮触发 onClose", closeCalls.n === 1, closeCalls);

// ── 错误态：请求失败不该白屏 ──────────────────────────────────────────────
await settle(); // 清掉上一段挂起的请求回调，否则它会盖掉本段的状态
globalThis.fetch = async () => {
  throw new Error("boom");
};
hookStates = [];
const errTree = render(Panel, { t, onClose: () => {} });
check("请求失败后仍渲染出骨架", Boolean(errTree) && findAll(errTree, (n) => n.type === "div").length > 0);
await settle();
const errTree2 = render(Panel, { t, onClose: () => {} });
check("错误信息出现在顶栏", textOf(errTree2).includes("boom"), textOf(errTree2).slice(0, 200));

// ── 整页模式（原生主面板用的那种承载）────────────────────────────────────
await settle();
globalThis.fetch = async (url, options) => {
  fetchCalls.push({ url, method: (options && options.method) || "GET", body: options && options.body });
  return { ok: true, status: 200, json: async () => ({ dir: "D:\\dsh\\memoir", categories: categoryFixture() }) };
};
hookStates = [];
fetchCalls.length = 0;
render(Panel, { t, variant: "page", onClose: () => {} });
await settle();
const pageTree = render(Panel, { t, variant: "page", onClose: () => {} });
check("整页模式没有遮罩层", findAll(pageTree, (n) => n.props.className === "__mm_mask").length === 0);
check("整页模式有页面容器", findAll(pageTree, (n) => n.props.className === "__mm_page").length === 1);
check("整页模式不显示关闭按钮", !byTitle(pageTree, "T:close"), "不该有关闭按钮");
check("整页模式有「返回对话」按钮", textOf(pageTree).includes("T:back"), textOf(pageTree).slice(0, 160));
check("整页模式照样渲染出条目", textOf(pageTree).includes("称呼只能用「主人」"), textOf(pageTree).slice(0, 160));
check("整页模式仍是对话框语义", findAll(pageTree, (n) => n.props.role === "dialog").length === 1);

// 接线：main 面板上的「返回对话」真的会调 ctx.layout.selectPanel(null)
hookStates = [];
render(Panel, { t, variant: "page", onExit: mainProps.onExit, onClose: () => {} });
await settle();
const wired = render(Panel, { t, variant: "page", onExit: mainProps.onExit, onClose: () => {} });
const backBtn = byText(wired, "button", "T:back");
check("找得到「返回对话」按钮", Boolean(backBtn), textOf(wired).slice(0, 160));
backBtn.props.onClick();
check("点它会调 ctx.layout.selectPanel(null) 回对话", layoutCalls.length === 1 && layoutCalls[0] === null, layoutCalls);

// ── 设置面板 ──────────────────────────────────────────────────────────────
// 放最后：它会改共享的 hook 状态，必须跑在其它面板测试之后。
hookStates = [];
fetchCalls.length = 0;
// 前面的失败重试测试替换过 globalThis.fetch，这里装回基于 fetchResponder 的那版；
// 不装回来的话请求会走别的 mock，设置拉不到，回填断言就会看到空串。
globalThis.fetch = async (url, options) => {
  fetchCalls.push({ url, method: (options && options.method) || "GET", body: options && options.body });
  const body = fetchResponder(url, options);
  if (body instanceof Error) throw body;
  return { ok: true, status: 200, json: async () => body };
};
fetchResponder = (url) => {
  if (String(url).includes("/settings")) {
    return { settings: { enabled: true, distillProvider: "local-llama", distillModel: "qwen3-8b" }, effective: {} };
  }
  return { dir: "D:\\dsh\\memoir", categories: categoryFixture() };
};

render(Panel, { t, onClose: () => {} });
await settle();
const gear = byTitle(render(Panel, { t, onClose: () => {} }), "T:settings");
check("顶栏有设置入口（⚙）", Boolean(gear), "没找到 title=T:settings 的按钮");
check("设置入口默认不是选中态", !String(gear?.props?.className ?? "").includes("__mm_iconBtnOn"), gear?.props?.className);

gear.props.onClick();
// apiFetch 是 fetch → json() → then() 三级 promise，一个 tick 不够
await settle();
await settle();
await settle();
const inSettings = render(Panel, { t, onClose: () => {} });
const settingsText = textOf(inSettings);
check("点开后去拉 /settings", fetchCalls.some((c) => String(c.url).endsWith("/api/dsh-memoir/settings")), fetchCalls.map((c) => c.url));
check("同时也去拉 /models（列宿主已注册的模型）", fetchCalls.some((c) => String(c.url).endsWith("/api/dsh-memoir/models")), fetchCalls.map((c) => c.url));
check("设置视图有写入总开关", settingsText.includes("T:enabled"), settingsText.slice(0, 240));
check("设置视图有模型定制（服务商 + 模型）", settingsText.includes("T:provider") && settingsText.includes("T:model"), settingsText.slice(0, 240));
check("设置视图有思考程度", settingsText.includes("T:effort"), settingsText.slice(0, 240));
check("设置视图有界面语言", settingsText.includes("T:language"), settingsText.slice(0, 240));
check("设置入口切到选中态", String(byTitle(inSettings, "T:settings")?.props?.className ?? "").includes("__mm_iconBtnOn"));

const settingsInputs = findAll(inSettings, (n) => n.type === "input");
check(
  "已存的服务商与模型回填进输入框",
  settingsInputs.some((n) => n.props.defaultValue === "local-llama") && settingsInputs.some((n) => n.props.defaultValue === "qwen3-8b"),
  settingsInputs.map((n) => n.props.defaultValue)
);
const toggle = settingsInputs.filter((n) => n.props.type === "checkbox")[0];
check("写入开关是勾上的（enabled=true）", toggle?.props.checked === true, toggle?.props);

const selects = findAll(inSettings, (n) => n.type === "select");
check("四个下拉：模型目录 + 思考程度 + 界面语言 + 记忆语言", selects.length === 4, selects.length);
check("设置视图有「从宿主已注册的模型里选」入口", settingsText.includes("T:pickModel") || settingsText.includes("T:noCatalog"), settingsText.slice(0, 320));
check("设置视图有记忆语言（跟界面语言是两件事）", settingsText.includes("T:memoryLanguage"), settingsText.slice(0, 300));
const memLangSelect = selects.find((n) => JSON.stringify(n.children ?? "").includes("T:memoryLangAuto"));
check("记忆语言下拉带「不限制」选项", Boolean(memLangSelect), "没找到记忆语言下拉");
// 注意：这个替身把 children 放在 node.children 上，不在 props 上。
const langSelect = selects.find((n) => ["zh", "en", "fr", "de", "ja"].every((code) => JSON.stringify(n.children ?? "").includes(`"${code}"`)));
check("语言下拉给出五种语言", Boolean(langSelect), "没找到含五种语言的下拉");
const effortSelect = selects.find((n) => JSON.stringify(n.children ?? "").includes('"off"'));
check("思考程度下拉给出 off/low/high/max/none", effortSelect && ["off", "low", "high", "max", "none"].every((v) => JSON.stringify(effortSelect.children ?? "").includes(`"${v}"`)), "选项不全");

fetchCalls.length = 0;
toggle.props.onChange({ target: { checked: false } });
await settle();
const patch = fetchCalls.find((c) => c.method === "PATCH");
check("关掉开关会发 PATCH /settings", Boolean(patch) && String(patch.url).endsWith("/settings"), fetchCalls.map((c) => `${c.method} ${c.url}`));
check("PATCH 带上 enabled=false", patch && JSON.parse(patch.body).enabled === false, patch?.body);

fetchCalls.length = 0;
langSelect.props.onChange({ target: { value: "fr" } });
await settle();
const langPatch = fetchCalls.find((c) => c.method === "PATCH");
check("切语言会发 PATCH 并带上 locale", langPatch && JSON.parse(langPatch.body).locale === "fr", langPatch?.body);
fetchCalls.length = 0;
memLangSelect.props.onChange({ target: { value: "en" } });
await settle();
const memPatch = fetchCalls.find((c) => c.method === "PATCH");
check("切记忆语言会发 PATCH 并带上 memoryLanguage", memPatch && JSON.parse(memPatch.body).memoryLanguage === "en", memPatch?.body);

fetchResponder = () => ({ dir: "D:\\dsh\\memoir", categories: categoryFixture() });

console.log(failures === 0 ? "\n全部通过" : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
