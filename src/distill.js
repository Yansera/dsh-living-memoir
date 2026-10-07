/**
 * dsh-memoir — 会话结束自动提炼（node half 的一部分）
 *
 * 每轮对话结束（`turn/end`）后防抖触发一次：把这一段新增的对话喂给模型，
 * 让它挑出值得跨会话记住的东西，写进记忆册。
 *
 * 三条设计约束，都是被实际问题逼出来的：
 *   1. **等对话停下来**——`turn/end` 会连发，防抖到安静之后再跑，否则一段
 *      对话会被切成好几次重复提炼；
 *   2. **只消费新事件**——按会话存 seq 游标，失败不推进（下次重试），
 *      太短则推进（不值得为它再来一次）；
 *   3. **绝不阻塞会话**——提炼是后台行为，任何失败只写日志，不冒泡给宿主。
 */
/** 消息来源标记，用于在会话日志里认出这次调用是谁发的。 */
const SOURCE = { kind: "plugin", plugin: "dsh-memoir" };

/**
 * 懒加载 dsh-llm。
 * 静态 import 会让「宿主没有这个包」变成整个插件加载失败；而自动提炼是
 * 可选能力，不配拖垮工具与页面——所以推迟到真正要用的时候再解析。
 */
let llmModule = null;
async function loadLlmModule() {
  if (!llmModule) llmModule = await import("@deepseek-ai/dsh-llm");
  return llmModule;
}

/** 单次喂给模型的对话文本上限。 */
const MAX_TRANSCRIPT = 8000;

const PROMPT_HEAD = `你是「记忆册」的编辑。下面给你两样东西：记忆册现在的**全部内容**，以及主人和助手刚刚发生的一段对话。

你的任务不是往后追加，而是**改写整本记忆册**——像编辑维护一份活文档那样通读一遍，交出改好的完整版本：
- **合并**：同一件事的多种说法合成一句
- **改写**：过时、含糊、啰嗦的，重写成准确的一句话
- **删除**：不再成立、琐碎、会过期的
- **新增**：这次对话里值得长期记住的
- **分类也可以动**：需要新分类就自己新建（起个 id 和中文名），没用的分类整个去掉

【这本记忆册是什么】它只管**长期、宏观**的那一层——读一遍就能明白「主人是谁、我是谁、我们在做什么」。**短期的、技术的、过程性的一切都另有记忆系统负责，一个字都不要往这里放。**

【值得放进来】只有这四类：
- 主人的持久身份、习惯与偏好（怎么被称呼、喜欢什么、忌讳什么、要求我怎么做）
- 长期项目是什么、为什么做（一句话立意 + 当前阶段，不写进度流水）
- 与主人相关的、定下来的大方向决策
- 我自己的定位与风格

【绝不留下】——凡属于下面任何一条，**删掉**，它们由别的记忆系统负责：
- **任何技术实现细节**：怎么装插件、某个 API 怎么用、某个模块怎么设计、代码怎么写、配置项叫什么名字
- **任何踩坑与排查**：症状、原因、解法、「下次要注意」——哪怕它很有价值，也不属于这里
- **任何操作方法与纪律**：命令怎么写、什么时候该重启、先做什么后做什么
- 调试过程、进度流水、任务清单、「已完成 / 待办」这类状态
- 一次性的数字、临时参数、某次运行的结果
- 客套话、寒暄、情绪表达
- 同一件事的重复说法

【自检】每写一条都问一句：**「这条是在说主人和我，还是在说技术？」**——说技术的一律删掉。

【怎么分——按主题，不按信息类型】
顶层分类要**大而少**（三个上下）：「主人」「我」「在做的事」这个量级。
判断标准只有一条：**找东西的时候，我会先想「这是哪个主题、哪个项目」，而不是「这算决策、算偏好、还是算进展」。**

**一个项目的一切都放在它自己的小节里**——它的目标、它的决定、它的数据、它的下一步，全在「## 项目名」底下。
不要因为内容「性质不同」就把同一个项目拆到几个大类去（比如决定放「决策」、进展放「正在做的事」）——那样想了解一个项目得翻好几个地方。

好的样子：
  顶层：# 主人 / # 我 / # 在做的事
  「在做的事」下面：## 记忆册 / ## 修仙：进化网络

坏的样子：
  顶层：# 定下的决策 / # 偏好与规则 / # 正在做的事   ← 同一个项目的碎片散在三处

【三层结构，最多三层】
1. **分类**：就是上面的顶层主题。
2. **小节**：项目或主题，按需要自由铺。没有合适的小节就不写，条目直接挂在分类下。
3. **条目**：一条一句话。到此为止，不要再往下分。

【每个分类】
- id：小写字母、数字、连字符（它就是文件名）
- title：中文名
- hint：一句话说明这类放什么
- entries：每条的 section 填第二层的名字（没有就留空），text 是一句话、陈述句、不超过 80 字、主语明确、不带时间戳、不带「本次」「刚才」这类词

【规模：宁少勿多】合并优先于拆分——**能一句话说清的就别拆成两句**。
这次改写如果让总条数**变多**了，先回头检查：那些新条目是不是本来就能并进已有句子？
目标不是「记得全」，是「读一遍就懂」。软上限 30 条，硬上限 60 条。

输出严格的 JSON 数组，一个元素是一个分类，前后不要任何别的文字：
[{"id":"user","title":"主人","hint":"他是谁、他要我怎么做","entries":[
  {"section":"","text":"…","importance":1到5的整数},
  {"section":"记忆册","text":"…","importance":4}
]}]

**即使这段对话没有值得新增的，也要输出改写后的完整记忆册**（可以跟现在一模一样）。`;

/** 从消息内容里取公开文本（reasoning 之类的私有块不进上下文）。 */
function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => (typeof block === "string" ? block : block && block.type === "text" && typeof block.text === "string" ? block.text : ""))
    .filter(Boolean)
    .join("\n");
}

/**
 * 把事件窗口压成一段可读对话。
 * @param events - 该窗口内的会话事件。
 * @returns 逐行对话文本；没有可用内容时返回空串。
 */
function transcriptOf(events) {
  const lines = [];
  for (const event of events) {
    const data = event?.data ?? {};
    if (event.type === "user/message") {
      const text = textOf(data.content).trim();
      if (text) lines.push(`【主人】${text}`);
    } else if (event.type === "assistant/message") {
      const text = textOf(data?.message?.content).trim();
      if (text) lines.push(`【我】${text}`);
    }
  }
  return lines.join("\n");
}

/**
 * 解析模型输出的「改写后的整本记忆册」。容忍 ```json 围栏、前后废话、
 * 以及截断到最后一个 `]`。
 * @param raw - 模型输出的原文。
 * @returns 形如 `{id, title, hint, entries:[{text, importance}]}` 的分类数组；解析不出就返回空数组。
 */
export function parseRewrite(raw) {
  const text = String(raw ?? "");
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("[");
  const end = body.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  let parsed;
  try {
    parsed = JSON.parse(body.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item) => item && typeof item.id === "string" && item.id.trim())
    .map((item) => ({
      id: item.id.trim().toLowerCase(),
      title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : item.id.trim(),
      hint: typeof item.hint === "string" ? item.hint.trim() : "",
      entries: (Array.isArray(item.entries) ? item.entries : [])
        .filter((entry) => entry && typeof entry.text === "string" && entry.text.trim())
        .map((entry) => ({
          section: typeof entry.section === "string" ? entry.section.trim() : "",
          text: entry.text.trim(),
          importance: Number.isFinite(entry.importance) ? Math.min(5, Math.max(1, Math.round(entry.importance))) : 3,
        })),
    }));
}

/**
 * 造一个提炼器。
 * @param options.ctx - 宿主上下文。
 * @param options.store - 记忆库（来自 index.js）。
 * @param options.resolveConfig - 取当前配置的函数（配置可能是 volatile 代理）。
 * @returns `{ dispose }`，dispose 会摘钩子、清定时器并放弃在飞的请求。
 */
export function createDistiller({ ctx, store, resolveConfig }) {
  /** sessionId → 已消费到的 seq。 */
  const cursors = new Map();
  /** sessionId → 防抖定时器。 */
  const timers = new Map();
  /** 全局串行队列：多个会话同时收尾时，LLM 请求排队而不是一拥而上。 */
  let chain = Promise.resolve();
  let disposed = false;
  /**
   * 诊断计数。
   * 自动提炼是后台行为，出问题只会写进宿主日志——而桌面客户端的宿主日志
   * 拿不到。所以把这些计数暴露到 /api/dsh-memoir/state：出问题时 curl 一下
   * 就知道它跑没跑、卡在哪一步、报了什么错，不用猜。
   */
  const stats = {
    runs: 0,
    llmCalls: 0,
    added: 0,
    skipped: 0,
    skipReason: null,
    lastAt: null,
    lastError: null,
    // 空输出的排查线索：模型到底吐了哪些块、走的哪条路由。
    // 没有这几个字段，就只能看到「model produced no text」这种没用的结论，
    // 猜不出是推理吃光了预算，还是请求压根没按预期发出去。
    lastBlocks: null,
    lastRoute: null,
    lastOutputLen: null,
  };

  const log = (message) => ctx.logger?.info?.(`[memoir] ${message}`);
  const warn = (message) => ctx.logger?.warn?.(`[memoir] ${message}`);

  /** 取一次提炼要用的模型路由（拿不到就用宿主默认）。 */
  function route() {
    try {
      const selection = ctx.get?.("agentDefaultModel")?.currentSelection?.();
      if (selection?.provider && selection?.model) return selection;
    } catch {
      /* 没有默认模型服务时退回适配器默认 */
    }
    return null;
  }

  /** 真正跑一次提炼；调用方保证已串行化。 */
  async function run(session) {
    stats.runs += 1;
    stats.lastAt = new Date().toISOString();
    const config = resolveConfig();
    if (config.autoDistill === false) {
      stats.skipped += 1;
      stats.skipReason = "autoDistill=false";
      return;
    }
    const llm = ctx.get?.("llm");
    if (!llm || typeof llm.stream !== "function") {
      stats.skipped += 1;
      stats.skipReason = "no-llm-service";
      return;
    }

    const from = cursors.get(session.id) ?? 0;
    const through = typeof session.seq === "number" ? session.seq : undefined;
    if (through === undefined || through <= from) {
      stats.skipped += 1;
      stats.skipReason = "no-new-events";
      return;
    }

    const events = typeof session.snapshotEvents === "function" ? session.snapshotEvents(from, through) : [];
    const transcript = transcriptOf(events).slice(-MAX_TRANSCRIPT);
    const minChars = Number(config.distillMinChars) || 400;
    if (transcript.length < minChars) {
      // 内容太少不值得提炼，但游标要推进，否则每个 turn/end 都会重评同一段。
      cursors.set(session.id, through);
      stats.skipped += 1;
      stats.skipReason = `transcript-too-short(${transcript.length}<${minChars})`;
      return;
    }

    const maxItems = Number(config.distillMaxItems) || 60;
    // 改写模式：把整本记忆册原样喂进去，模型交出改好的完整版本。
    const snapshot = store.readAll();
    const existing = snapshot
      .map((category) => {
        const head = `## ${category.id} — ${category.title}${category.hint ? `（${category.hint}）` : ""}`;
        const lines = category.entries.map((entry) => {
          const where = entry.section ? `{${entry.section}} ` : "";
          return `- [${entry.importance}] ${where}${entry.text}`;
        });
        return [head, ...(lines.length ? lines : ["（空）"])].join("\n");
      })
      .join("\n\n");

    // 容量触发：某个分类或整本涨过头了，这一次就必须动手整理，而不是小修小补。
    const pageLimit = Number(config.pageEntryLimit) || 12;
    const bookLimit = Number(config.bookEntryLimit) || 40;
    const total = snapshot.reduce((sum, category) => sum + category.entries.length, 0);
    const overflow = snapshot.filter((category) => category.entries.length > pageLimit);
    const needTidy = total > bookLimit || overflow.length > 0;
    const tidyOrder = needTidy
      ? [
          "【本次必须整理】规模已经超标，这次不能只小修小补：",
          `- 现状：整本 ${total} 条（软上限 ${bookLimit}）` +
            (overflow.length > 0
              ? `；超限的分类：${overflow.map((category) => `「${category.title}」${category.entries.length} 条`).join("、")}（单类上限 ${pageLimit}）`
              : ""),
          "- **合并**：同一件事、同义或高度相关的条目合成一句；",
          "- **缩略**：啰嗦的长条目压成一句话，只留结论；",
          "- **加小节**：条目多的分类用 `##` 小节拆开（比如「主人」下面按 语音 / 游戏 / 习惯 分节），不要二十多条平铺；",
          "- **回落到上限以内**：整理完整本不超过软上限，每个分类也降到单类上限以内。",
        ].join("\n")
      : "";
    // 改写要吐出整本记忆册：预算得跟着记忆规模走，否则记忆一多就注定说不完。
    const configuredTokens = Number(config.distillMaxTokens) || 8000;
    const outputBudget = Math.max(configuredTokens, Math.ceil(existing.length * 1.2) + 2000);
    const prompt = [
      PROMPT_HEAD,
      "",
      "--- 记忆册的现状 ---",
      existing || "（还是空的）",
      "",
      "--- 刚发生的对话 ---",
      transcript,
      "--- 对话结束 ---",
      "",
      `改写后的整本记忆册，条目总数控制在 ${maxItems} 条以内。`,
      tidyOrder,
    ].join("\n");

    const { BlockAssembler, createUserMessage } = await loadLlmModule();
    const base = {
      messages: [createUserMessage({ content: [{ type: "text", text: prompt }], source: SOURCE })],
      maxTokens: outputBudget,
      purpose: "memoir-distill",
    };
    const selected = route();
    if (selected) {
      base.provider = selected.provider;
      base.model = selected.model;
    }

    // 思考型模型会把 token 预算烧在推理上、正文空体——mneme 在 dream 里踩过
    // 同一个坑（它为此专门配了 dreamReasoningEffort: low）。所以这里显式压低
    // 推理档位；provider 不认这个字段时，去掉它重试一次。
    const effort = String(config.distillReasoningEffort ?? "off");
    const callStream = async (withEffort) => {
      const assembler = new BlockAssembler();
      const options = withEffort && effort && effort !== "none" ? { ...base, reasoningEffort: effort } : base;
      stats.llmCalls += 1;
      for await (const chunk of llm.stream(options)) assembler.push(chunk);
      return assembler;
    };
    let assembler;
    try {
      assembler = await callStream(true);
    } catch (error) {
      if (!effort || effort === "none") throw error;
      warn(`提炼带 reasoningEffort=${effort} 被拒（${String(error?.message ?? error)}），去掉该字段重试一次`);
      assembler = await callStream(false);
    }
    const blocks = assembler.blocks();
    stats.lastBlocks = blocks.map((block) => block.type).join("+") || "(empty)";
    stats.lastRoute = `${base.provider ?? "default"}/${base.model ?? "default"} effort=${effort}`;
    const output = blocks
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    stats.lastOutputLen = output.length;

    if (!output) throw new Error("model produced no text");

    const rewritten = parseRewrite(output);
    if (rewritten.length === 0) throw new Error("改写结果为空，保留原样");

    const before = store.readAll().reduce((sum, category) => sum + category.entries.length, 0);
    const after = rewritten.reduce((sum, category) => sum + category.entries.length, 0);
    // 安全网：模型偶尔会「重写」成半本。条目本来就少时不设限（那是正常精简），
    // 有了一定规模后骤减一半以上就拒绝——宁可这次不写，也不让它把记忆删残。
    if (before >= 6 && after < before / 2) {
      throw new Error(`改写后条目从 ${before} 骤减到 ${after}，拒绝写入（保留原样）`);
    }

    store.replaceAll(rewritten);
    cursors.set(session.id, through);
    stats.added = after;
    log(`自动提炼改写完成：${rewritten.length} 个分类 / ${after} 条（会话 ${session.id}）`);
  }

  /** 把一次提炼排进全局串行队列，失败只记日志（同时留下诊断）。 */
  function enqueue(session) {
    chain = chain
      .then(() => (disposed ? undefined : run(session)))
      .catch((error) => {
        if (disposed || error?.name === "AbortError") return;
        stats.lastError = String(error?.message ?? error);
        warn(`自动提炼失败（会话 ${session.id}）：${String(error)}`);
      });
    return chain;
  }

  /** 防抖：等这段对话安静下来再跑。 */
  function schedule(session) {
    if (disposed) return;
    const debounce = Math.max(0, Number(resolveConfig().distillDebounceMs) ?? 20000);
    const existing = timers.get(session.id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      timers.delete(session.id);
      void enqueue(session);
    }, debounce);
    timers.set(session.id, timer);
  }

  const unsubscribe = ctx.on?.("session/event", (session, event) => {
    if (disposed || event?.type !== "turn/end") return;
    schedule(session);
  });

  return {
    /** 诊断快照，给 /state 用。 */
    stats: () => ({ ...stats, cursors: cursors.size, pending: timers.size }),
    dispose() {
      if (disposed) return;
      disposed = true;
      if (typeof unsubscribe === "function") unsubscribe();
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      cursors.clear();
    },
  };
}
