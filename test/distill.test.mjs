/**
 * 记忆册 自动提炼 自测：用假的会话事件流 + 假的 llm 服务，把 distill.js 的
 * 触发、防抖、游标推进、失败重试、写出全部跑一遍。
 *   node test-distill.mjs
 */
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore } from "../src/index.js";
import { createDistiller, parseRewrite } from "../src/distill.js";

let failures = 0;
const check = (label, condition, extra) => {
  if (condition) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.log(`  FAIL ${label}${extra === undefined ? "" : ` — ${JSON.stringify(extra)?.slice(0, 300)}`}`);
  }
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── 输出解析 ──────────────────────────────────────────────────────────────
console.log("解析模型输出（改写后的整本记忆册）");
const R = (json) => parseRewrite(json);
check("标准分类数组", R('[{"id":"user","title":"关于主人","entries":[{"text":"A","importance":5}]}]').length === 1);
check("容忍 ```json 围栏", R('```json\n[{"id":"user","entries":[{"text":"A"}]}]\n```')[0]?.entries[0]?.text === "A");
check(
  "容忍前后废话",
  R('好的，这是改写结果：\n[{"id":"lessons","entries":[{"text":"B"}]}]\n希望有用！')[0]?.entries[0]?.text === "B"
);
check("空数组", R("[]").length === 0);
check("没有数组时返回空", R("我没什么要改的").length === 0);
check("非法 JSON 返回空", R("[{bad json").length === 0);
check("缺 id 的分类被丢掉", R('[{"title":"没有 id"},{"id":"user","entries":[]}]').length === 1);
check("缺 title 时回落到 id", R('[{"id":"user","entries":[]}]')[0].title === "user");
check("id 会被规范成小写", R('[{"id":"XianXia","entries":[]}]')[0].id === "xianxia");
check("缺 text 的条目被丢掉", R('[{"id":"user","entries":[{"nope":1},{"text":"D"}]}]')[0].entries.length === 1);
check("importance 越界被夹住", R('[{"id":"user","entries":[{"text":"E","importance":99}]}]')[0].entries[0].importance === 5);
check("无 importance 默认 3", R('[{"id":"user","entries":[{"text":"F"}]}]')[0].entries[0].importance === 3);
check("没有 entries 字段时视为空分类", R('[{"id":"user"}]')[0].entries.length === 0);
check("条目的 section 会被保留", R('[{"id":"user","entries":[{"section":"记忆册","text":"A"}]}]')[0].entries[0].section === "记忆册");
check("没有 section 时是空串", R('[{"id":"user","entries":[{"text":"B"}]}]')[0].entries[0].section === "");
check("section 两边空白被清掉", R('[{"id":"user","entries":[{"section":"  记忆册  ","text":"C"}]}]')[0].entries[0].section === "记忆册");

// ── 提炼器行为 ────────────────────────────────────────────────────────────
console.log("\n提炼器行为");
const dir = mkdtempSync(join(tmpdir(), "memoir-distill-"));
const store = createStore(dir);

const handlers = {};
const services = {};
const logs = [];
const ctx = {
  logger: { info: (m) => logs.push(m), warn: (m) => logs.push(`WARN ${m}`) },
  on: (event, handler) => {
    handlers[event] = handler;
    return () => delete handlers[event];
  },
  get: (service) => services[service],
};

/** 造一段足够长的对话事件。 */
const makeEvents = (count) =>
  Array.from({ length: count }, (_, i) => ({
    type: i % 2 === 0 ? "user/message" : "assistant/message",
    seq: i,
    data: i % 2 === 0 ? { content: [{ type: "text", text: `主人说的第 ${i} 句，这里要够长才能过门槛` }] } : { message: { content: [{ type: "text", text: `我回的第 ${i} 句，同样要够长才能过门槛` }] } },
  }));

const makeSession = (id, events) => ({
  id,
  seq: events.length,
  snapshotEvents: (from, through) => events.slice(from, through),
});

const config = { autoDistill: true, distillDebounceMs: 10, distillMinChars: 100, distillMaxItems: 60, distillMaxTokens: 4000, distillReasoningEffort: "low" };
const resolveConfig = () => config;

let llmOutput = '[{"id":"user","title":"关于主人","hint":"身份、习惯","entries":[{"text":"主人喜欢简短回复","importance":4}]}]';
let llmCalls = 0;
let llmShouldThrow = false;
let lastOptions = null;
let rejectEffort = false;
let effortRejections = 0;
services.llm = {
  async *stream(options) {
    llmCalls += 1;
    lastOptions = options;
    if (options && options.reasoningEffort !== undefined && rejectEffort) {
      effortRejections += 1;
      throw new Error("unsupported field: reasoningEffort");
    }
    if (llmShouldThrow) throw new Error("llm exploded");
    if (!llmOutput) {
      yield { type: "finish", reason: "stop" };
      return;
    }
    // 真实 StreamChunk 形状：block-start → text-delta → block-end → finish。
    yield { type: "block-start", index: 0, blockType: "text" };
    yield { type: "text-delta", index: 0, text: llmOutput };
    yield { type: "block-end", index: 0, block: { type: "text", text: llmOutput } };
    yield { type: "finish", reason: "stop" };
  },
};
services.agentDefaultModel = { currentSelection: () => ({ provider: "p", model: "m" }) };

const distiller = createDistiller({ ctx, store, resolveConfig });
check("挂上了 session/event 钩子", typeof handlers["session/event"] === "function");

// 非 turn/end 事件不触发
handlers["session/event"](makeSession("s0", makeEvents(12)), { type: "turn/start" });
await wait(60);
check("turn/start 不触发提炼", llmCalls === 0, llmCalls);

// 正常提炼
const session = makeSession("s1", makeEvents(12));
handlers["session/event"](session, { type: "turn/end" });
await wait(80);
check("turn/end 触发了一次 LLM 调用", llmCalls === 1, llmCalls);
check("提炼出的记忆落进记忆册", store.read("user").some((e) => e.text === "主人喜欢简短回复"), store.read("user"));
check("来源被标成自动提炼", store.read("user")[0]?.source === "自动提炼", store.read("user")[0]);
check("提炼压低推理档位（否则预算会被推理烧光、正文空体）", lastOptions?.reasoningEffort === "low", lastOptions?.reasoningEffort);
check("maxTokens 用了配置值", lastOptions?.maxTokens === 4000, lastOptions?.maxTokens);
check("带了 purpose 便于审计", lastOptions?.purpose === "memoir-distill", lastOptions?.purpose);

// 游标：同一段不该被重复消费
llmCalls = 0;
handlers["session/event"](session, { type: "turn/end" });
await wait(80);
check("同一段对话不重复提炼", llmCalls === 0, llmCalls);

// 太短跳过，但游标推进
llmCalls = 0;
const shortSession = makeSession("s2", [{ type: "user/message", seq: 0, data: { content: [{ type: "text", text: "嗯" }] } }]);
handlers["session/event"](shortSession, { type: "turn/end" });
await wait(80);
check("内容太短不调 LLM", llmCalls === 0, llmCalls);
handlers["session/event"](shortSession, { type: "turn/end" });
await wait(80);
check("太短的窗口游标也推进了", llmCalls === 0, llmCalls);

// 失败不推进游标 → 下次重试
llmCalls = 0;
llmShouldThrow = true;
const failSession = makeSession("s3", makeEvents(12));
handlers["session/event"](failSession, { type: "turn/end" });
await wait(80);
check("LLM 失败时仍走一次去掉 effort 的重试（与 mneme 的 dream 同款容错）", llmCalls === 2, llmCalls);
check("失败写进了日志", logs.some((l) => l.includes("自动提炼失败")), logs.slice(-3));
llmShouldThrow = false;
handlers["session/event"](failSession, { type: "turn/end" });
await wait(80);
check("游标没推进，同一段下次会重新提炼", llmCalls === 3, llmCalls);
check("重试成功后写入", store.read("user").length >= 1);

// 改写是整盘替换：模型给出什么，记忆库就是什么（不再往后追加）
llmOutput =
  '[{"id":"user","title":"关于主人","hint":"身份、习惯","entries":[{"text":"主人喜欢简短的回复","importance":4}]},' +
  '{"id":"lessons","title":"踩过的坑","entries":[{"text":"改写模式会删掉没提到的分类","importance":3}]}]';
const rewriteSession = makeSession("s4", makeEvents(12));
handlers["session/event"](rewriteSession, { type: "turn/end" });
await wait(80);
check(
  "改写后分类集合就是模型给的那两个",
  store.readAll().map((c) => c.id).join(",") === "user,lessons",
  store.readAll().map((c) => c.id)
);
check("改写后条目被整盘替换", store.read("user")[0]?.text === "主人喜欢简短的回复", store.read("user"));
check("模型没提到的分类，文件真的被删了", store.read("projects").length === 0 && store.read("decisions").length === 0);

// 安全网：模型偶尔会「重写」成半本，条目骤减就拒绝写入、保留原样
for (let i = 0; i < 8; i += 1) store.add({ category: "lessons", text: `凑数条目第 ${i} 条`, importance: 3 });
const beforeCount = store.readAll().reduce((n, c) => n + c.entries.length, 0);
llmOutput = '[{"id":"user","title":"关于主人","entries":[]}]';
const shrinkSession = makeSession("s4b", makeEvents(12));
handlers["session/event"](shrinkSession, { type: "turn/end" });
await wait(80);
const afterCount = store.readAll().reduce((n, c) => n + c.entries.length, 0);
check("条目骤减时拒绝写入、保留原样", afterCount === beforeCount, { beforeCount, afterCount });
check("拒绝原因写进了日志", logs.some((l) => l.includes("骤减")), logs.slice(-2));

// 模型输出为空 → 视为失败，不写垃圾
llmOutput = "";
llmCalls = 0;
const emptySession = makeSession("s5", makeEvents(12));
handlers["session/event"](emptySession, { type: "turn/end" });
await wait(80);
check("空输出被当成失败", logs.some((l) => l.includes("produced no text")), logs.slice(-2));

// 关掉开关后完全不跑
llmCalls = 0;
config.autoDistill = false;
const offSession = makeSession("s6", makeEvents(12));
handlers["session/event"](offSession, { type: "turn/end" });
await wait(80);
check("autoDistill=false 时不调用 LLM", llmCalls === 0, llmCalls);
config.autoDistill = true;

// 没有 llm 服务时静默跳过
llmCalls = 0;
const savedLlm = services.llm;
delete services.llm;
const noLlmSession = makeSession("s7", makeEvents(12));
handlers["session/event"](noLlmSession, { type: "turn/end" });
await wait(80);
check("没有 llm 服务时静默跳过", llmCalls === 0, llmCalls);
services.llm = savedLlm;

// 防抖：连发多次 turn/end 只提炼一次
llmCalls = 0;
const burstSession = makeSession("s8", makeEvents(12));
for (let i = 0; i < 5; i += 1) handlers["session/event"](burstSession, { type: "turn/end" });
await wait(100);
check("连发 5 次 turn/end 只提炼一次", llmCalls === 1, llmCalls);

// provider 不认 reasoningEffort：去掉字段重试一次，而不是直接失败
llmOutput = '[{"id":"lessons","title":"踩过的坑","entries":[{"text":"重试路径也要能出结果","importance":3}]}]';
rejectEffort = true;
effortRejections = 0;
llmCalls = 0;
const effortSession = makeSession("s10", makeEvents(12));
handlers["session/event"](effortSession, { type: "turn/end" });
await wait(100);
check("被拒时重试一次（总共两次调用）", effortRejections === 1 && llmCalls === 2, { effortRejections, llmCalls });
check("重试那次没带 reasoningEffort", lastOptions?.reasoningEffort === undefined, lastOptions?.reasoningEffort);
rejectEffort = false;

// 诊断计数：桌面客户端拿不到宿主日志，出问题全靠它
const st = distiller.stats();
check("stats 记录了运行次数", st.runs > 0, st.runs);
check("stats 记录了 LLM 调用次数", st.llmCalls > 0, st.llmCalls);
check("stats 记录了写入条数", st.added > 0, st.added);
check("stats 留下了上次错误（诊断用）", typeof st.lastError === "string" && st.lastError.length > 0, st.lastError);
check("stats 暴露了游标与待办数", typeof st.cursors === "number" && typeof st.pending === "number", st);
check("stats 记下了跳过原因", typeof st.skipReason === "string", st.skipReason);
check("stats 记下了模型吐出的块类型（空输出的关键线索）", typeof st.lastBlocks === "string" && st.lastBlocks.includes("text"), st.lastBlocks);
check("stats 记下了实际路由与推理档位", typeof st.lastRoute === "string" && st.lastRoute.includes("effort=low"), st.lastRoute);
check("stats 记下了输出长度", st.lastOutputLen > 0, st.lastOutputLen);

// dispose 之后不再响应
llmCalls = 0;
distiller.dispose();
check("dispose 摘掉了钩子", handlers["session/event"] === undefined);
const afterDisposeSession = makeSession("s9", makeEvents(12));
await wait(60);
check("dispose 后不再提炼", llmCalls === 0, llmCalls);

rmSync(dir, { recursive: true, force: true });
console.log(failures === 0 ? "\n全部通过" : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
