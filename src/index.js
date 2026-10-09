/**
 * dsh-memoir — node half（记忆册 · 后台半）
 *
 * 把跨会话记忆整理成分门别类、简短可读的 Markdown：一个分类一个文件，
 * 一条记忆是一行列表项，元数据写在紧跟的 HTML 注释里（渲染时不显示，
 * 解析时精确）。
 *
 * 对外提供四件事：
 *   1. 存储层   —— 读写记忆目录里的分类 md 文件；
 *   2. 模型工具 —— memoir_note / memoir_recall / memoir_forget；
 *   3. 系统提示 —— 每次组装实时生成一份「记忆目录」，只带有界条数；
 *   4. HTTP 路由 —— 给浏览器半（专属页面）读写记忆。
 *
 * 另外在每轮对话结束后跑一次自动提炼（见 ./distill.js）。
 * 浏览器半在 ./client.js。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import { randomBytes } from "node:crypto";
import z from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { createDistiller } from "./distill.js";

/** Cordis 插件名。 */
const name = "memoir";

/** 本插件需要的宿主服务。 */
const inject = ["tools", "systemPrompt", "webServer"];

/** 路由前缀（浏览器半用同一个常量）。 */
const API_PREFIX = "/api/dsh-memoir";

/**
 * 起步用的默认分类——**只在记忆目录为空时**用来起个头。
 * 之后分类就由模型自己增删维护了：目录里有哪些 md，就有哪些分类。
 */
const DEFAULT_CATEGORIES = [
  { id: "user", title: "关于用户", hint: "身份、环境、习惯、称呼" },
  { id: "preferences", title: "偏好与规则", hint: "希望助手怎么做、不许怎么做" },
  { id: "projects", title: "正在做的事", hint: "项目、当前进展、下一步" },
  { id: "decisions", title: "定下的决策", hint: "选了哪条路、为什么" },
  { id: "self", title: "关于助手", hint: "助手怎么自我介绍、用什么风格配合" },
];

/** 分类 id 的形状：它同时是文件名，所以只允许小写字母、数字和连字符。 */
const CATEGORY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** 目录里记录分类顺序的提示文件（一行一个 id）。 */
const ORDER_FILE = ".order";

/** 取 md 首行的 `# 标题`。 */
function titleOf(raw) {
  return /^#\s+(.+?)\s*$/m.exec(String(raw ?? ""))?.[1]?.trim() ?? "";
}

/** 每份文件都有的固定提示语；读回来时要排除，别把它当成分类自己的说明。 */
const MAINTAINER_NOTE = "由 dsh-memoir 维护，可以直接手工编辑：加一行 “- 内容” 就等于加一条记忆";

/** 取标题下那条说明注释——去掉固定提示语之后，剩下的才是分类自己的 hint。 */
function hintOf(raw) {
  const meta = /^<!--\s*(.+?)\s*-->\s*$/m.exec(String(raw ?? ""));
  if (!meta) return "";
  return meta[1]
    .split("·")
    .map((part) => part.trim())
    .filter((part) => part && part !== MAINTAINER_NOTE)
    .join(" · ");
}

/** 读分类顺序提示；没有就返回空数组。 */
function readOrder(memoryDir) {
  const path = join(memoryDir, ORDER_FILE);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * 扫描记忆目录，得到当前的全部分类。
 * 文件名即分类 id；顺序按 `.order`，没记进去的排在末尾，所以模型新建的
 * 分类会自然落到后面。空目录返回空数组——默认分类由调用方按需铺。
 * @param memoryDir - 记忆库目录。
 * @returns 分类数组（含 id / title / hint），按展示顺序。
 */
function discoverCategories(memoryDir) {
  if (!existsSync(memoryDir)) return [];
  // 没有 .order 时用默认分类的顺序兜底：老库升级上来少了这个提示文件，
  // 不该突然变成字母序——页面和注入里的分类会莫名其妙重排。
  const order = readOrder(memoryDir);
  const ranking = order.length > 0 ? order : DEFAULT_CATEGORIES.map((category) => category.id);
  const rank = (id) => {
    const index = ranking.indexOf(id);
    return index < 0 ? ranking.length + 1 : index;
  };
  return readdirSync(memoryDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const id = name.slice(0, -3);
      const raw = readFileSync(join(memoryDir, name), "utf8");
      return { id, title: titleOf(raw) || id, hint: hintOf(raw) };
    })
    .sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
}

/**
 * 校验分类 id 的形状。
 * 分类本身是自由的（模型随时能新建），所以这里只挡形状：它同时是文件名，
 * 不能带路径分隔符或别的花样。
 * @param id - 待校验的分类 id。
 * @returns 规范化后的 id。
 */
function assertCategory(id) {
  const value = String(id ?? "").trim();
  if (!CATEGORY_ID_PATTERN.test(value)) {
    throw new Error(`invalid category id: ${JSON.stringify(id)}（只能用小写字母、数字、连字符，且以字母或数字开头）`);
  }
  return value;
}

/** 配置：部署可变项全部走这里，不写死在代码里。 */
const Config = z.object({
  /** 记忆库目录；留空则用 `$DSH_HOME/memoir`。 */
  memoryDir: z.string().default(""),
  /** 是否把「记忆目录」注入系统提示。 */
  injectIndex: z.boolean().default(true),
  /** 注入时最多带多少条记忆（按重要度取）。 */
  maxInjectEntries: z.number().default(12),
  /** 是否在每轮对话结束后自动提炼记忆。 */
  autoDistill: z.boolean().default(true),
  /** 提炼前的安静等待（毫秒）：等这段对话停下来再跑，免得被切碎重复提炼。 */
  distillDebounceMs: z.number().default(20_000),
  /** 新增对话少于这么多字符就跳过提炼（游标照常推进）。 */
  distillMinChars: z.number().default(400),
  /** 记忆册的条目总数上限：改写时提示模型控制规模，超了就合并或删。 */
  distillMaxItems: z.number().default(60),
  /**
   * 单个分类的条目软上限。超过它就触发一次「强制整理」——合并同义条目、
   * 把长句缩成一句、条目太多就在这一层下面开 `##` 小节拆开。
   */
  pageEntryLimit: z.number().default(12),
  /** 整本记忆册的条目软上限；超过同样触发强制整理。 */
  bookEntryLimit: z.number().default(40),
  /**
   * 改写输出的 token 下限（不是硬上限——代码会按当前记忆规模往上抬，
   * 因为改写要吐出整本记忆册，规模越大要的预算越多）。
   */
  distillMaxTokens: z.number().default(8000),
  /**
   * 改写时的推理档位。
   * 改写是「整理」不是「解题」，而思考型模型会把输出预算烧在推理上、正文
   * 空体——实测整本记忆册的改写量下，光推理就把 4000 token 吃光了。
   * 所以默认 "off" 彻底关掉思考；"low"/"high"/"max" 可恢复，"none" = 不发送该字段。
   */
  distillReasoningEffort: z.string().default("off"),
  /**
   * 记忆内容用哪种语言写（zh / en / fr / de / ja）。留空 = 不限制，
   * 模型多半跟着对话语言走。
   *
   * 跟界面语言是两回事：界面语言只换按钮文案，这个决定**存进 md 里的字**。
   */
  memoryLanguage: z.string().default(""),
});

/** 一条记忆的最大字符数——「简短可读」是这套东西的立身之本。 */
const MAX_TEXT = 400;

/**
 * 运行时自述。
 * 客户端只在「安装插件那一刻」加载一次代码，之后改文件它不认——所以需要一个
 * 能从外部读到的版本标记：curl 一下 `/api/dsh-memoir/state` 就知道它跑的是哪一版。
 */
const PACKAGE = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const RUNTIME_INFO = {
  name: PACKAGE.name,
  version: PACKAGE.version,
  capabilities: ["dedupe-v2", "distiller"],
};

/** 解析 `$DSH_HOME`，回退到 `~/.dsh`。 */
function dshHome() {
  return process.env.DSH_HOME || join(os.homedir(), ".dsh");
}

/** 造一个短 id：8 位十六进制，够用且好念。 */
function newId() {
  return randomBytes(4).toString("hex");
}

/** 今天日期（本地时区），形如 `2026-10-06`。 */
function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 解析一个分类 md 文件。
 *
 * 认两种行：
 *   `- 正文`                        —— 开一条新记忆
 *   `  <!-- memoir id=… imp=… -->`  —— 上一条的元数据（可选）
 * 其余行（标题、说明、空行、被注释掉的旧格式）一律忽略，所以手工编辑
 * 这个文件是安全的：加一行 `- xxx` 就等于在页面上加一条。
 *
 * @param raw - 文件全文。
 * @param category - 所属分类 id。
 * @returns 记忆条目数组，按文件内出现顺序。
 */
function parseCategory(raw, category) {
  const entries = [];
  let current = null;
  /** 当前所属的第二层小节；空串表示条目直接挂在分类下。 */
  let section = "";
  const flush = () => {
    if (!current) return;
    current.text = current.text.trim();
    if (current.text) entries.push(current);
    current = null;
  };
  for (const line of raw.split(/\r?\n/)) {
    // 第二层：`## 小节名`（项目、主题都放这一层）。第三层就是 `-` 条目，到此为止。
    const subsection = /^##\s+(.+?)\s*$/.exec(line);
    if (subsection) {
      flush();
      section = subsection[1].trim();
      continue;
    }
    // 一级标题是文件头，跳过；更深的 `###` 不认，当排版忽略。
    if (/^#\s+/.test(line)) {
      flush();
      continue;
    }
    const item = /^[-*]\s+(.*)$/.exec(line);
    if (item) {
      flush();
      current = {
        id: newId(),
        category,
        section,
        text: item[1],
        importance: 3,
        // confidence：这条有多可信。high = 用户亲口说的；med = 从对话里提炼的；
        // low = 助手推断的。改写要删东西时先丢 low。
        confidence: "med",
        // pinned：钉住的条目改写时必须原样保留（数量有上限）。
        pinned: false,
        updatedAt: today(),
        source: "",
      };
      continue;
    }
    const meta = /^\s*<!--\s*memoir\s+(.*?)\s*-->\s*$/.exec(line);
    if (meta && current) {
      for (const field of meta[1].split("|")) {
        const [key, ...rest] = field.trim().split("=");
        const value = rest.join("=").trim();
        if (key === "id" && value) current.id = value;
        else if (key === "imp") current.importance = clampImportance(Number(value));
        else if (key === "at" && value) current.updatedAt = value;
        else if (key === "src" && value) current.source = value;
        else if (key === "conf" && /^(high|med|low)$/.test(value)) current.confidence = value;
        // pin 写成裸词（没有等号），也容忍 pin=true / pin=1。
        else if (key === "pin") current.pinned = value === "" || value === "true" || value === "1";
      }
      continue;
    }
    // 独立的 HTML 注释行（说明文字、旧格式残留）既不是记忆也不是续行。
    if (/^\s*<!--.*-->\s*$/.test(line)) continue;
    // 续行（缩进 2 空格以上）并入上一条，允许一条记忆写成多行。
    if (current && /^\s{2,}\S/.test(line)) {
      current.text += "\n" + line.trim();
      continue;
    }
    if (line.trim() === "") continue;
    // 标题、引用、普通段落都是文件自己的排版，不属于任何一条记忆。
    flush();
  }
  flush();
  return entries;
}

/** 把 1~5 之外的输入夹回合法区间；NaN 回落 3。 */
/** 置信度取值；不认识的当 med。 */
function normalizeConfidence(value) {
  return value === "high" || value === "low" ? value : "med";
}

/** 两个置信度取较高的那个。 */
function higherConfidence(a, b) {
  const rank = { low: 0, med: 1, high: 2 };
  const x = normalizeConfidence(a);
  const y = normalizeConfidence(b);
  return rank[x] >= rank[y] ? x : y;
}

function clampImportance(value) {
  if (!Number.isFinite(value)) return 3;
  return Math.min(5, Math.max(1, Math.round(value)));
}

/**
 * 归一化正文，用于重复判定：去掉空白与常见标点，只留实义字符。
 * @param text - 原始正文。
 * @returns 归一化后的字符串。
 */
function normalizeText(text) {
  return String(text ?? "")
    .replace(/\s+/g, "")
    .replace(/[，。！？、；：""''（）()【】\[\]「」《》·…—~!?,.;:'"()\-]/g, "");
}

/**
 * 相邻双字组集合（bigram）。中文没有词边界，双字组是最省事又够准的指纹。
 * @param text - 原始正文。
 * @returns 去重后的双字组；文本短于 2 字时返回单元素集合。
 */
function bigramsOf(text) {
  const s = normalizeText(text);
  if (s.length < 2) return new Set(s ? [s] : []);
  const grams = new Set();
  for (let i = 0; i < s.length - 1; i += 1) grams.add(s.slice(i, i + 2));
  return grams;
}

/**
 * 两句正文的相似度（Dice 系数）。
 * @param a - 一句正文。
 * @param b - 另一句正文。
 * @returns 0~1；完全无关为 0，逐字相同为 1。
 */
function similarity(a, b) {
  const A = bigramsOf(a);
  const B = bigramsOf(b);
  if (A.size === 0 || B.size === 0) return 0;
  let common = 0;
  for (const gram of A) if (B.has(gram)) common += 1;
  return (2 * common) / (A.size + B.size);
}

/** 判定两条记忆是不是同一件事的阈值。 */
const DUPLICATE_SIMILARITY = 0.75;

/**
 * 用正文派生一个稳定 id。
 * 全量改写会重排条目，而模型不该操心 id——所以 id 来自内容本身：
 * 改写后正文没变，页面上的 id 就不变，旧链接和正在编辑的条目都不会跑掉。
 * @param text - 条目正文。
 * @returns 8 位十六进制 id。
 */
function contentId(text) {
  let hash = 0;
  const s = normalizeText(text);
  for (let i = 0; i < s.length; i += 1) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * 序列化一个分类为 md。
 * @param category - 分类定义。
 * @param entries - 条目数组。
 * @returns 文件全文，结尾恰好一个换行。
 */
function serializeCategory(category, entries) {
  const hintLine = [category.hint, MAINTAINER_NOTE].filter(Boolean).join(" · ");
  const head = [`# ${category.title}`, "", `<!-- ${hintLine} -->`, "", ""].join("\n");
  if (entries.length === 0) return head + "\n";

  const bullet = (entry) => {
    const meta = [`id=${entry.id || contentId(entry.text)}`, `imp=${entry.importance}`];
    // conf 只在非默认值时写——绝大多数条目是 med，全写出来会淹没正文。
    if (entry.confidence && entry.confidence !== "med") meta.push(`conf=${entry.confidence}`);
    meta.push(`at=${entry.updatedAt}`);
    if (entry.source) meta.push(`src=${entry.source}`);
    if (entry.pinned) meta.push("pin");
    const text = entry.text.includes("\n") ? entry.text.split("\n").join("\n  ") : entry.text;
    return `- ${text}\n  <!-- memoir ${meta.join(" | ")} -->`;
  };

  // 第二层按小节分组：没有小节的排最前，其余按小节名首次出现的顺序。
  const noSection = [];
  const groups = new Map();
  for (const entry of entries) {
    const key = entry.section ?? "";
    if (!key) {
      noSection.push(entry);
      continue;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  const blocks = [];
  if (noSection.length > 0) blocks.push(noSection.map(bullet).join("\n\n"));
  for (const [section, items] of groups) {
    blocks.push(`## ${section}\n\n${items.map(bullet).join("\n\n")}`);
  }
  return `${head}${blocks.join("\n\n")}\n`;
}

/**
 * 记忆库：一个目录 + 若干分类文件。
 * 每次读写都直接落盘，不做缓存——文件都很小，换来的是「手工改了文件页面立刻就能看到」。
 */
function createStore(memoryDir) {
  const ensureDir = () => {
    if (!existsSync(memoryDir)) mkdirSync(memoryDir, { recursive: true });
  };

  const fileOf = (categoryId) => join(memoryDir, `${categoryId}.md`);

  /** 原子写：先写临时文件再改名，避免页面读到半截文件。 */
  const writeAtomic = (path, content) => {
    const tmp = `${path}.tmp-${process.pid}`;
    writeFileSync(tmp, content, "utf8");
    renameSync(tmp, path);
  };

  /** 读一个分类的全部条目。文件不存在视为空分类。 */
  const read = (categoryId) => {
    const path = fileOf(categoryId);
    if (!existsSync(path)) return [];
    return parseCategory(readFileSync(path, "utf8"), categoryId);
  };

  /** 把分类 id 记进 `.order`（没有就追加到末尾），让新建的分类排在后面。 */
  const rememberOrder = (id) => {
    const order = readOrder(memoryDir);
    if (order.includes(id)) return;
    writeAtomic(join(memoryDir, ORDER_FILE), `${[...order, id].join("\n")}\n`);
  };

  /** 目录空着时铺一份默认分类，免得页面上一片空白。 */
  const seedDefaults = () => {
    ensureDir();
    writeAtomic(join(memoryDir, ORDER_FILE), `${DEFAULT_CATEGORIES.map((c) => c.id).join("\n")}\n`);
    for (const category of DEFAULT_CATEGORIES) {
      writeAtomic(fileOf(category.id), serializeCategory(category, []));
    }
  };

  /** 写一个分类的全部条目；分类不存在就现建，标题和说明沿用旧的或由调用方给。 */
  const write = (categoryId, entries, meta = {}) => {
    ensureDir();
    const id = assertCategory(categoryId);
    const path = fileOf(id);
    const previous = existsSync(path) ? readFileSync(path, "utf8") : "";
    const category = {
      id,
      title: String(meta.title ?? "").trim() || titleOf(previous) || id,
      hint: String(meta.hint ?? "").trim() || hintOf(previous),
    };
    writeAtomic(path, serializeCategory(category, entries));
    rememberOrder(id);
  };

  /** 读全部分类，返回页面直接可用的结构。 */
  const readAll = () => {
    let categories = discoverCategories(memoryDir);
    if (categories.length === 0) {
      seedDefaults();
      categories = discoverCategories(memoryDir);
    }
    return categories.map((category) => ({ ...category, entries: read(category.id) }));
  };

  /** 按 id 找一条记忆，附带它所属的分类 id。 */
  const find = (id) => {
    for (const category of discoverCategories(memoryDir)) {
      const entries = read(category.id);
      const index = entries.findIndex((e) => e.id === id);
      if (index >= 0) return { categoryId: category.id, entries, index, entry: entries[index] };
    }
    return null;
  };

  /**
   * 新增一条记忆。
   *
   * 重复判定分两档：正文完全相同，或一条完整包含另一条（短的那条至少 8 字）。
   * 自动提炼会反复产出近义句，缺了后一档，记忆库很快会被同义句撑满——
   * 而这套东西存在的理由正是「短到有人愿意读」。
   * @returns `{ action, entry }`，action ∈ added | merged。
   */
  const add = ({ category, text, importance, source, confidence, categoryTitle, section }) => {
    assertCategory(category);
    const clean = String(text ?? "").trim().slice(0, MAX_TEXT);
    if (!clean) throw new Error("memoir: empty text");
    const entries = read(category);
    const duplicate = entries.find((existing) => {
      if (existing.text === clean) return true;
      const a = normalizeText(existing.text);
      const b = normalizeText(clean);
      if (!a || !b) return false;
      // 一档是包含（长句把短句整个盖住），一档是近似（差一个「的」这种）。
      const [short, long] = a.length <= b.length ? [a, b] : [b, a];
      if (short.length >= 8 && long.includes(short)) return true;
      return similarity(a, b) >= DUPLICATE_SIMILARITY;
    });
    if (duplicate) {
      // 保留更完整的那条：包含关系里短句是长句的旧版本。
      if (clean.length > duplicate.text.length) duplicate.text = clean;
      duplicate.importance = clampImportance(Math.max(importance ?? 0, duplicate.importance));
      // 置信度取两者较高的——用户亲口说过的，不该被一次自动提炼降级。
      duplicate.confidence = higherConfidence(duplicate.confidence, confidence);
      duplicate.updatedAt = today();
      if (source) duplicate.source = String(source);
      write(category, entries, { title: categoryTitle });
      return { action: "merged", entry: duplicate };
    }
    const entry = {
      id: newId(),
      category,
      section: String(section ?? "").trim(),
      text: clean,
      importance: clampImportance(importance ?? 3),
      confidence: normalizeConfidence(confidence),
      pinned: false,
      updatedAt: today(),
      source: source ? String(source) : "模型",
    };
    entries.push(entry);
    write(category, entries, { title: categoryTitle });
    return { action: "added", entry };
  };

  /** 更新一条记忆；`move` 传了就换分类。 */
  const update = (id, patch) => {
    const found = find(id);
    if (!found) return null;
    const { categoryId, entries, index, entry } = found;
    const next = {
      ...entry,
      text: patch.text !== undefined ? String(patch.text).trim().slice(0, MAX_TEXT) : entry.text,
      importance: patch.importance !== undefined ? clampImportance(patch.importance) : entry.importance,
      updatedAt: today(),
    };
    if (!next.text) throw new Error("memoir: empty text");
    const targetCategory = patch.category ? assertCategory(patch.category) : categoryId;
    if (targetCategory === categoryId) {
      entries[index] = next;
      write(categoryId, entries);
    } else {
      entries.splice(index, 1);
      write(categoryId, entries);
      const target = read(targetCategory);
      target.push({ ...next, category: targetCategory });
      write(targetCategory, target);
    }
    return next;
  };

  /** 删除一条记忆。 */
  const remove = (id) => {
    const found = find(id);
    if (!found) return false;
    found.entries.splice(found.index, 1);
    write(found.categoryId, found.entries);
    return true;
  };

  /** 关键词搜索：正文与分类标题都算命中，按重要度降序。 */
  const search = (query, categoryId) => {
    const needle = String(query ?? "").trim().toLowerCase();
    const pool = categoryId
      ? discoverCategories(memoryDir)
          .filter((category) => category.id === categoryId)
          .map((category) => ({ ...category, entries: read(category.id) }))
      : readAll();
    const hits = [];
    for (const category of pool) {
      for (const entry of category.entries) {
        if (!needle || entry.text.toLowerCase().includes(needle) || category.title.includes(needle)) {
          hits.push({ ...entry, categoryTitle: category.title });
        }
      }
    }
    return hits.sort((a, b) => b.importance - a.importance || b.updatedAt.localeCompare(a.updatedAt));
  };

  /**
   * 全量改写：用给定结构覆盖整个记忆库——该建的建、该删的删、顺序照给的重排。
   * 这是「编辑」模式的写入口：模型每次通读全文、输出改写后的完整版本，
   * 这里负责把它落成文件，并把这次没出现的分类文件真的删掉。
   * @param categories - `[{ id, title, hint, entries: [{ text, importance, source }] }]`
   * @returns 写入的分类数。
   */
  const replaceAll = (categories) => {
    ensureDir();
    const keep = [];
    for (const category of categories ?? []) {
      const id = assertCategory(category.id);
      if (keep.includes(id)) continue;
      keep.push(id);
      const entries = (category.entries ?? [])
        .map((entry) => ({
          id: "",
          category: id,
          section: String(entry.section ?? "").trim(),
          text: String(entry.text ?? "").trim().slice(0, MAX_TEXT),
          importance: clampImportance(entry.importance ?? 3),
          // 置信度与钉住标记由改写层传下来；漏了就按「中等置信、没钉住」处理。
          confidence: normalizeConfidence(entry.confidence),
          pinned: entry.pinned === true,
          updatedAt: today(),
          source: entry.source ? String(entry.source) : "自动提炼",
        }))
        .filter((entry) => entry.text);
      write(id, entries, { title: category.title, hint: category.hint });
    }
    // 模型删掉的分类，文件也要跟着消失，否则下次又被扫出来。
    const keepSet = new Set(keep);
    for (const existing of discoverCategories(memoryDir)) {
      if (!keepSet.has(existing.id)) rmSync(fileOf(existing.id), { force: true });
    }
    writeAtomic(join(memoryDir, ORDER_FILE), keep.length ? `${keep.join("\n")}\n` : "");
    return keep.length;
  };

  return { dir: memoryDir, ensureDir, read, write, readAll, find, add, update, remove, search, replaceAll };
}

/**
 * 生成注入系统提示的「记忆目录」。
 * 刻意做成有界的：只带高重要度的前 N 条，每条一行——记住的东西越多，
 * 越要保证这一块不膨胀，否则每个会话都在为陈旧记忆付 token。
 *
 * @param store - 记忆库。
 * @param limit - 最多带多少条。
 * @returns 提示文本；没有任何记忆时返回空串（不占位）。
 */
function renderIndex(store, limit) {
  const all = store.readAll();
  const total = all.reduce((sum, c) => sum + c.entries.length, 0);
  if (total === 0) return "";
  const picked = [];
  for (const category of all) {
    for (const entry of category.entries) {
      picked.push({ ...entry, categoryTitle: category.title });
    }
  }
  picked.sort((a, b) => b.importance - a.importance || b.updatedAt.localeCompare(a.updatedAt));
  const shown = picked.slice(0, Math.max(1, limit));
  const lines = [
    "## 记忆册",
    "",
    `跨会话记忆共 ${total} 条，以下是重要度最高的 ${shown.length} 条（完整内容在「记忆册」页面；需要更多用 memoir_recall 查）。`,
    "",
  ];
  let lastCategory = null;
  for (const entry of shown) {
    if (entry.categoryTitle !== lastCategory) {
      lines.push(`**${entry.categoryTitle}**`);
      lastCategory = entry.categoryTitle;
    }
    const oneLine = entry.text.replace(/\s*\n\s*/g, " ");
    lines.push(`- ${oneLine}`);
  }
  lines.push("");
  lines.push("新学到的持久信息（用户的偏好、定下的决策、踩过的坑）用 memoir_note 记进去；记错了用 memoir_forget 删。");
  return lines.join("\n");
}

/** JSON 响应。 */
function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  res.end(body);
}

/** 读一个 JSON 请求体（上限 1MB，够页面用且不至于被拖死）。 */
async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error("body too large");
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

/** 运行时可改设置的文件名。放在记忆库目录里，跟记忆数据一起走。 */
const SETTINGS_FILE = ".settings.json";

/**
 * 第一次运行（还没有 `.settings.json`）时的默认值。
 *
 * 这个包是公开分发的，所以默认英文界面 + 英文记忆内容。
 * 用户改过就以文件为准——选「跟随宿主 / 不限制」会如实存成空串，不会被这里盖回去。
 */
const SETTINGS_DEFAULTS = { enabled: true, locale: "en", memoryLanguage: "en" };

/**
 * 运行时可改设置的读写。
 *
 * 存在记忆库目录里而不是包目录：换 profile 不丢、升级插件也不会把用户设置覆盖掉。
 * 文件坏了或不存在都当「没设置过」——设置读不出来不该让整个插件起不来。
 * @param dirOf - 返回当前记忆库目录的函数（目录本身是可配的）。
 * @returns `{ read, write }`；write 是浅合并，只传要改的键。
 */
function createRuntimeSettings(dirOf) {
  const fileOf = () => join(dirOf(), SETTINGS_FILE);
  const read = () => {
    try {
      const parsed = JSON.parse(readFileSync(fileOf(), "utf8"));
      return parsed && typeof parsed === "object" ? parsed : { ...SETTINGS_DEFAULTS };
    } catch {
      // 文件还不存在 = 第一次运行，用面向公开分发的默认值。
      return { ...SETTINGS_DEFAULTS };
    }
  };
  const write = (patch) => {
    const next = { ...read(), ...(patch ?? {}) };
    const dir = dirOf();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const path = fileOf();
    const tmp = `${path}.tmp-${process.pid}`;
    writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    renameSync(tmp, path);
    return next;
  };
  return { read, write };
}

/**
 * 插件入口。
 * @param ctx - 宿主上下文。
 * @param config - 解析后的配置（可能是 volatile 代理，读的时候再取）。
 */
function apply(ctx, config) {
  const rawConfig = () => (typeof config?.get === "function" ? config.get() : config) ?? {};
  const configuredDir = () => {
    const dir = String(rawConfig().memoryDir ?? "").trim();
    return dir || join(dshHome(), "memoir");
  };
  const settings = createRuntimeSettings(configuredDir);
  /**
   * 生效的配置 = `cordis.patch.yml` 的配置，被页面上的运行时设置覆盖。
   *
   * 总开关关掉时，这里**强制**停掉注入和改写——「既不读取也不写入」这条
   * 在最靠上的地方落定，下游每个读配置的地方自动跟着变，不用各自判断一遍。
   */
  const resolveConfig = () => {
    const merged = { ...rawConfig(), ...settings.read() };
    if (merged.enabled === false) return { ...merged, injectIndex: false, autoDistill: false };
    return merged;
  };
  const store = createStore(configuredDir());
  store.ensureDir();
  store.readAll(); // 空目录时铺一份默认分类，免得第一次打开什么都没有
  ctx.logger?.info?.(`[memoir] 记忆库目录：${store.dir}`);
  /** 自动提炼器；null = 这个宿主没有会话事件，或插件已卸载。 */
  let distiller = null;

  // ── 模型工具 ────────────────────────────────────────────────────────────
  const noteTool = defineTool({
    name: "memoir_note",
    description:
      "把一条跨会话记忆写进「记忆册」。当用户说出持久偏好、定下项目决策、纠正我、或我踩到值得记住的坑时调用。" +
      "一条记忆要短（一句话，别超过 400 字），写成未来会话一看就懂的陈述句。" +
      "同一分类下正文完全相同会被合并，不会重复堆积。",
    parameters: {
      category: {
        type: "string",
        required: true,
        description: "分类 id（小写字母、数字、连字符，同时就是文件名）。用现有分类，或直接给一个新 id —— 会自动建这个分类。",
      },
      category_title: {
        type: "string",
        description: "新建分类时给它起的中文名；分类已存在时这个参数被忽略",
      },
      section: {
        type: "string",
        description: "可选的第二层小节名（项目名、主题名）。同一类里按项目分开放这一层；留空就直接挂在分类下",
      },
      text: { type: "string", required: true, description: "一句话正文；写成陈述句" },
      importance: { type: "integer", description: "1-5，默认 3；5 表示每次会话都该看到" },
      source: { type: "string", description: "来源，例如「用户明确说」「观测」「从会话提炼」" },
      confidence: {
        type: "string",
        description:
          "这条有多可信：high = 用户亲口说的；med（默认）= 从对话里提炼的；low = 你自己推断的",
      },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          action: { type: "string", required: true },
          id: { type: "string", required: true },
          category: { type: "string", required: true },
        },
      },
      render: (_args, value) => [
        { type: "text", text: `记忆册 ${value.action === "merged" ? "已合并到" : "已记下"} ${value.category}/${value.id}` },
      ],
    },
    async execute(args) {
      if (resolveConfig().enabled === false) {
        throw new Error("记忆册的写入总开关是关的（在「记忆册」页面的设置里打开），这次不记。");
      }
      const result = store.add({
        category: args.category,
        text: args.text,
        importance: args.importance,
        confidence: args.confidence,
        source: args.source,
        categoryTitle: args.category_title,
        section: args.section,
      });
      return { action: result.action, id: result.entry.id, category: result.entry.category };
    },
  });

  const recallTool = defineTool({
    name: "memoir_recall",
    description:
      "查「记忆册」。给 query 就按关键词搜正文，给 category 就限定分类，两个都不给就全量列出（按重要度降序）。" +
      "系统提示里只有重要度最高的若干条，需要更全或更早的记忆时用这个工具。",
    parameters: {
      query: { type: "string", description: "关键词，大小写不敏感，匹配正文" },
      category: {
        type: "string",
        description: "限定分类 id；不传就全量搜",
      },
      limit: { type: "integer", description: "最多返回几条，默认 30" },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          total: { type: "integer", required: true },
          text: { type: "string", required: true },
        },
      },
      render: (_args, value) => [{ type: "text", text: value.text }],
    },
    async execute(args) {
      if (resolveConfig().enabled === false) {
        return { total: 0, text: "记忆册已被关闭（写入总开关），现在不读取任何记忆。" };
      }
      const hits = store.search(args.query, args.category);
      const limit = Number.isFinite(args.limit) ? Math.max(1, Math.round(args.limit)) : 30;
      const shown = hits.slice(0, limit);
      const text = shown.length === 0
        ? "记忆册里没有匹配的条目。"
        : shown
            .map((e) => `- [${e.categoryTitle}] ${e.text.replace(/\s*\n\s*/g, " ")}  （id=${e.id} 重要度=${e.importance} 更新=${e.updatedAt}）`)
            .join("\n");
      return { total: hits.length, text };
    },
  });

  const forgetTool = defineTool({
    name: "memoir_forget",
    description: "从「记忆册」里删掉一条记错或过时的记忆。先用 memoir_recall 拿到 id。",
    parameters: {
      id: { type: "string", required: true, description: "记忆 id，来自 memoir_recall 的输出" },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          removed: { type: "boolean", required: true },
          id: { type: "string", required: true },
        },
      },
      render: (_args, value) => [
        { type: "text", text: value.removed ? `记忆册已删除 ${value.id}` : `记忆册里没有 ${value.id}` },
      ],
    },
    async execute(args) {
      if (resolveConfig().enabled === false) {
        throw new Error("记忆册的写入总开关是关的（在「记忆册」页面的设置里打开），这次不改动。");
      }
      const removed = store.remove(String(args.id));
      return { removed, id: String(args.id) };
    },
  });

  for (const tool of [noteTool, recallTool, forgetTool]) {
    ctx.effect(() => ctx.tools.register(tool), `memoir: tool ${tool.name}`);
  }

  // ── 系统提示注入 ────────────────────────────────────────────────────────
  // text 用函数形式：每次组装实时读盘，页面上一改，下一轮就生效。
  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: "memoir:index",
        order: 15_000,
        text: () => {
          const cfg = resolveConfig();
          if (cfg.injectIndex === false) return "";
          return renderIndex(store, Number(cfg.maxInjectEntries) || 12);
        },
      }),
    "memoir: prompt section",
  );

  // ── HTTP 路由（浏览器半的数据通道）────────────────────────────────────────
  const routes = [
    {
      kind: "exact",
      path: `${API_PREFIX}/state`,
      handler: (_req, res) => {
        sendJson(res, 200, {
          dir: store.dir,
          runtime: RUNTIME_INFO,
          // 自动提炼是后台行为，而桌面客户端的宿主日志拿不到——把它的诊断
          // 一并暴露出来，出问题时 curl 一下就知道它跑没跑、卡在哪一步。
          distill: distiller ? distiller.stats() : { enabled: false },
          settings: settings.read(),
          effective: {
            enabled: resolveConfig().enabled !== false,
            injectIndex: resolveConfig().injectIndex !== false,
            autoDistill: resolveConfig().autoDistill !== false,
            distillProvider: String(resolveConfig().distillProvider ?? ""),
            distillModel: String(resolveConfig().distillModel ?? ""),
            distillReasoningEffort: String(resolveConfig().distillReasoningEffort ?? ""),
            memoryLanguage: String(resolveConfig().memoryLanguage ?? ""),
          },
          categories: store.readAll(),
        });
      },
    },
    {
      // 页面上的设置面板读写这里。跟别的插件路由一样不需要 GUI token。
      kind: "exact",
      path: `${API_PREFIX}/settings`,
      handler: async (req, res) => {
        try {
          if (req.method === "GET") {
            sendJson(res, 200, { settings: settings.read(), effective: resolveConfig(), dir: configuredDir() });
            return;
          }
          if (req.method === "PATCH" || req.method === "PUT" || req.method === "POST") {
            const body = await readJsonBody(req);
            const saved = settings.write(body);
            sendJson(res, 200, { ok: true, settings: saved, effective: resolveConfig() });
            return;
          }
          sendJson(res, 405, { error: `method not allowed: ${req.method}` });
        } catch (error) {
          sendJson(res, 400, { error: String(error?.message ?? error) });
        }
      },
    },
    {
      // 宿主已经注册了哪些 provider、每个下面有哪些模型——页面上拿它做成下拉。
      // 用户不该需要知道 provider 叫什么、模型 id 怎么写：DSH 里关联好了就该列出来。
      kind: "exact",
      path: `${API_PREFIX}/models`,
      handler: async (_req, res) => {
        try {
          const llm = ctx.get?.("llm");
          const providers = llm?.listProviders?.() ?? [];
          const out = [];
          for (const provider of providers) {
            let models = [];
            try {
              models = (await llm.listModels(provider.id)) ?? [];
            } catch {
              // 单个 provider 列不出来（网关没起、没配 key）不该拖垮整个列表。
              models = [];
            }
            out.push({
              id: provider.id,
              name: provider.name || provider.id,
              models: models.map((model) => ({
                id: model.id,
                name: model.name || model.id,
                description: model.description ?? "",
                efforts: (model.reasoning?.efforts ?? []).map((effort) => effort.id),
                defaultEffort: model.reasoning?.defaultEffort ?? "",
              })),
            });
          }
          sendJson(res, 200, { providers: out });
        } catch (error) {
          sendJson(res, 500, { error: String(error?.message ?? error) });
        }
      },
    },
    {
      kind: "exact",
      path: `${API_PREFIX}/entry`,
      handler: async (req, res) => {
        try {
          // 这个路由做的全是写操作（POST / PATCH / DELETE），总开关关掉就一律拒绝。
          if (resolveConfig().enabled === false) {
            sendJson(res, 403, { error: "记忆册的写入总开关是关的，先在「设置」里打开。" });
            return;
          }
          if (req.method === "POST") {
            const body = await readJsonBody(req);
            const { action, entry } = store.add({
              category: body.category,
              text: body.text,
              importance: body.importance,
              source: body.source || "页面",
              categoryTitle: body.category_title,
              section: body.section,
            });
            sendJson(res, 200, { action, entry });
            return;
          }
          if (req.method === "PATCH" || req.method === "PUT") {
            const body = await readJsonBody(req);
            const updated = store.update(String(body.id), body);
            if (!updated) {
              sendJson(res, 404, { error: "not-found" });
              return;
            }
            sendJson(res, 200, { entry: updated });
            return;
          }
          if (req.method === "DELETE") {
            const id = new URL(req.url, "http://localhost").searchParams.get("id");
            const removed = id ? store.remove(id) : false;
            sendJson(res, removed ? 200 : 404, { removed });
            return;
          }
          sendJson(res, 405, { error: "method-not-allowed" });
        } catch (error) {
          ctx.logger?.warn?.(`[memoir] entry route failed: ${String(error)}`);
          sendJson(res, 400, { error: String(error instanceof Error ? error.message : error) });
        }
      },
    },
    {
      kind: "prefix",
      path: API_PREFIX,
      handler: (_req, res) => sendJson(res, 404, { error: "not-found" }),
    },
  ];
  ctx.effect(() => {
    const disposers = routes.map((route) => ctx.webServer.register(route));
    return () => {
      for (const dispose of disposers) dispose();
    };
  }, "memoir: routes");

  // ── 每轮结束自动提炼 ────────────────────────────────────────────────────
  // 第三条写入通道：一轮对话安静下来后，后台把这一段里值得跨会话记住的
  // 东西挑出来。取不到 llm 服务时整段静默跳过，工具与页面照常工作。
  if (typeof ctx.on === "function") {
    ctx.effect(() => {
      const instance = createDistiller({ ctx, store, resolveConfig });
      distiller = instance;
      return () => {
        distiller = null;
        instance.dispose();
      };
    }, "memoir: distiller");
  }
}

export { API_PREFIX, DEFAULT_CATEGORIES, Config, apply, createStore, discoverCategories, inject, name, renderIndex };
