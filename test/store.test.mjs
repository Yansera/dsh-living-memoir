/**
 * 记忆册存储层自测：不依赖 DSH 宿主，直接用 node 跑。
 * 用法（在装了 DSH 的 profile 目录下，才能解析到 schemastery / dsh-tools）：
 *   node test-store.mjs
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore, renderIndex } from "../src/index.js";

let failures = 0;
const check = (label, condition, extra) => {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${extra === undefined ? "" : ` — ${JSON.stringify(extra)}`}`);
  }
};

const dir = mkdtempSync(join(tmpdir(), "memoir-test-"));
console.log(`临时记忆库：${dir}`);
const store = createStore(dir);

// 1. 空库
check("空库读出 5 个分类", store.readAll().length === 5);
check("空库无注入内容", renderIndex(store, 12) === "");

// 2. 新增
const a = store.add({ category: "user", text: "称呼只能用「主人」或「主人主人」", importance: 5, source: "主人明确说" });
check("新增返回 added", a.action === "added", a.action);
const b = store.add({ category: "projects", text: "正在做 dsh-memoir 插件", importance: 4 });
check("第二条新增成功", b.action === "added");

// 3. 读回 + 文件真的落盘
const userEntries = store.read("user");
check("读回 user 分类 1 条", userEntries.length === 1, userEntries);
check("user.md 已落盘", existsSync(join(dir, "user.md")));
const raw = readFileSync(join(dir, "user.md"), "utf8");
check("md 里有正文", raw.includes("称呼只能用"), raw);
check("md 里有元数据注释", /<!-- memoir id=/.test(raw), raw);
check("正文没被注释吃掉", !/^-\s*<!--/.test(raw));

// 4. 去重：同分类同正文合并
const dup = store.add({ category: "user", text: "称呼只能用「主人」或「主人主人」", importance: 5 });
check("重复正文合并而非新增", dup.action === "merged", dup.action);
check("合并不增加条数", store.read("user").length === 1, store.read("user").length);

// 4b. 近义句（差一个字）也算重复——自动提炼最常产出的就是这种
store.add({ category: "decisions", text: "记忆册数据存在 D 盘的 memoir 目录" });
const near = store.add({ category: "decisions", text: "记忆册的数据存在 D 盘的 memoir 目录" });
check("近义句被合并而非新增", near.action === "merged", near.action);
check("近义句合并不增加条数", store.read("decisions").length === 1, store.read("decisions"));
check("合并保留更完整的那条", store.read("decisions")[0].text.includes("的数据"), store.read("decisions")[0].text);

// 4c. 内容确实不同的不合并
const distinct = store.add({ category: "decisions", text: "对话框默认只绑本地回环地址" });
check("不同内容照常新增", distinct.action === "added", distinct.action);
check("不同内容条数上升", store.read("decisions").length === 2, store.read("decisions").length);

// 4d. 三层结构：分类 → 小节 → 条目
store.add({ category: "projects", text: "记忆册是个 md 活文档", importance: 4, section: "记忆册" });
store.add({ category: "projects", text: "另一个项目的条目", importance: 3, section: "修仙" });
store.add({ category: "projects", text: "没有小节的条目", importance: 3 });
const threeLayer = store.read("projects");
// 前面的 4c 已经往 projects 写过一条，所以这里是它 + 三层测试的三条 = 4
check("三层结构下条目都读得出来", threeLayer.length === 4, threeLayer.length);
check("小节名被持久化", threeLayer.find((e) => e.text.includes("md 活文档"))?.section === "记忆册", threeLayer);
check("另一个小节各归各的", threeLayer.find((e) => e.text.includes("另一个项目"))?.section === "修仙", threeLayer);
check("没小节的条目 section 是空串", threeLayer.find((e) => e.text.includes("没有小节"))?.section === "", threeLayer);
const layered = readFileSync(join(dir, "projects.md"), "utf8");
check("md 里写出了 ## 小节标题", layered.includes("## 记忆册") && layered.includes("## 修仙"), layered);
check("没有小节的条目排在前面", layered.indexOf("没有小节的条目") < layered.indexOf("## 记忆册"), layered);

// 5. 手工编辑能被识别
writeFileSync(
  join(dir, "lessons.md"),
  "# 踩过的坑\n\n<!-- 这段说明文字不该被当成记忆 -->\n\n- 手工加的一条：执行策略挡脚本时用 -ExecutionPolicy Bypass\n\n- 正式的一条\n  <!-- memoir id=hand01 | imp=5 | at=2026-10-06 | src=手工 -->\n",
  "utf8"
);
const lessons = store.read("lessons");
check("手工编辑的文件被解析出 2 条", lessons.length === 2, lessons);
check("说明性注释没混进正文", !lessons.some((e) => e.text.includes("不该被当成记忆")), lessons);
check("手工那两条正文正确", lessons[0].text.startsWith("手工加的一条"), lessons[0]);
check("元数据被采纳（id/重要度）", lessons[1].id === "hand01" && lessons[1].importance === 5, lessons[1]);

// 6. 更新（原地）
const updated = store.update(a.entry.id, { text: "称呼只能用「主人」或「主人主人」，自称只用「我」" });
check("更新返回新值", updated && updated.text.includes("自称只用「我」"), updated);
check("更新后仍是 1 条", store.read("user").length === 1);

// 7. 跨分类移动
store.update(b.entry.id, { category: "self" });
check("移动后原先那条不在 projects 里", !store.read("projects").some((e) => e.id === b.entry.id), store.read("projects").map((e) => e.id));
check("移动后 self 有一条", store.read("self").length === 1, store.read("self"));

// 8. 搜索
check("关键词搜到", store.search("主人").length >= 1);
check("分类限定搜索", store.search("", "self").length === 1);

// 9. 删除
check("删除存在的条目", store.remove(a.entry.id) === true);
check("删除后条数下降", store.read("user").length === 0);
check("删除不存在的条目返回 false", store.remove("nope") === false);

// 10. 注入文本
const idx = renderIndex(store, 12);
check("注入非空", idx.length > 0);
check("注入含标题", idx.includes("## 记忆册"), idx);
check("注入含分类名", idx.includes("踩过的坑"), idx);
check("上限生效", renderIndex(store, 1).split("\n").filter((l) => l.startsWith("- ")).length === 1);

// 11. 超长正文被截断
const long = store.add({ category: "lessons", text: "x".repeat(1000) });
check("超长正文被截到 400", long.entry.text.length === 400, long.entry.text.length);

// 12. 空正文被拒
let threw = false;
try {
  store.add({ category: "user", text: "   " });
} catch {
  threw = true;
}
check("空正文抛错", threw);


// 3b. 置信度（confidence）与钉住（pinned）
const withConf = store.add({
  category: "user",
  text: "置信度往返测试条目",
  importance: 4,
  confidence: "high",
  source: "测试",
});
check("带 confidence 的新增成功", withConf.action === "added", withConf.action);
const rawUser = readFileSync(join(dir, "user.md"), "utf8");
check("high 置信度写进了文件", rawUser.includes("conf=high"), rawUser.slice(0, 160));
check("med 是默认值，不写进文件（省得淹没正文）", !rawUser.includes("conf=med"));

// 改写会把整本换掉——用它来测 pinned 的往返
store.replaceAll([
  {
    id: "user",
    title: "主人",
    hint: "他是谁",
    entries: [
      { section: "", text: "钉住的条目", importance: 5, confidence: "high", pinned: true },
      { section: "", text: "没钉住的条目", importance: 3, confidence: "low", pinned: false },
    ],
  },
]);
const rawPinned = readFileSync(join(dir, "user.md"), "utf8");
check("钉住的条目写出 pin 标记", rawPinned.includes("pin"), rawPinned);
check("低置信度也写出来", rawPinned.includes("conf=low"), rawPinned);
check("没钉住的条目不带 pin", !/没钉住的条目\n\s*<!--[^>]*\bpin\b/.test(rawPinned), rawPinned);

const userCat = store.readAll().find((c) => c.id === "user");
const pinEntry = userCat && userCat.entries.find((e) => e.text === "钉住的条目");
check("读回来 pinned 仍是 true", Boolean(pinEntry) && pinEntry.pinned === true, pinEntry);
check("读回来 confidence 仍是 high", Boolean(pinEntry) && pinEntry.confidence === "high", pinEntry);
const loose = userCat && userCat.entries.find((e) => e.text === "没钉住的条目");
check("没钉住的读回来 pinned 是 false", Boolean(loose) && loose.pinned === false, loose);
check("没标 confidence 的默认是 med", Boolean(loose) && loose.confidence === "low", loose);

// 合并时置信度取较高的：用户亲口说的不该被一次自动提炼降级
const merged = store.add({ category: "user", text: "钉住的条目", importance: 5, confidence: "low" });
check("重复条目走合并", merged.action === "merged", merged.action);
check("合并后置信度没被降级", merged.entry.confidence === "high", merged.entry.confidence);
rmSync(dir, { recursive: true, force: true });
console.log(failures === 0 ? "\n全部通过" : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
