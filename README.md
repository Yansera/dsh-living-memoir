# 记忆册 · Memoir

[English](README.en.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [日本語](README.ja.md) · **简体中文**

[![CI](https://github.com/Yansera/dsh-living-memoir/actions/workflows/ci.yml/badge.svg)](https://github.com/Yansera/dsh-living-memoir/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@yansera/dsh-living-memoir?color=0969da&label=npm)](https://www.npmjs.com/package/@yansera/dsh-living-memoir)
[![license](https://img.shields.io/badge/license-MIT-8250df)](LICENSE)

DeepSeek Harness 的跨会话记忆插件。记忆存成一组 Markdown 文件，每轮对话结束后整个重写一遍，而不是往后追加。

![界面与记忆库](docs/assets/hero.zh.svg)

## 📦 安装

```sh
dsh plugin --profile desktop add @yansera/dsh-living-memoir
```

`desktop` 换成你的 profile 名。`dsh` 是 DeepSeek Harness 自带的 CLI，桌面版在 `<安装目录>\resources\runtime\cli\bin\dsh.cmd`。

从源码装：

```sh
dsh plugin --profile desktop add 'file:D:\path\to\dsh-living-memoir'
```

装完要完全退出客户端再打开。DSH 只在安装插件那一刻加载代码，关窗口不算退出。

## 🚀 用起来是什么样

侧边栏会出现「记忆册」，点开占满主区域：左边是分类，右边是条目。左上角「← 返回对话」回到会话。

之后不用配置。模型在你说出持久偏好、定下决策、纠正它的时候会自己写；你也可以点「记一条」，或者直接编辑 `$DSH_HOME/memoir/` 下的 md 文件，改完刷新页面就能看到。

想让它停下来，页面右上角设置里关掉「记忆写入」。关掉之后不读也不写。

## 🧱 三层结构

```
# 在做的事

<!-- 项目、当前阶段 · 可直接手工编辑 -->

## 记忆册

- 把跨会话记忆整理成分类简短的 md 活文档
  <!-- memoir id=a1b2c3d4 | imp=4 | conf=high | at=2026-10-07 | src=用户明确说 -->

## 修仙：进化网络

- 用基因突变与自然选择长出承载语义的拓扑
```

第一层是分类，一个分类一个 md 文件。第二层是小节，通常一个项目一个。第三层是条目，一条一句话，到此为止。

分类按主题划分，不按信息类型。找东西的时候人想的是「这是哪个项目」，不是「这算决策还是算进展」。同一个项目的一切都收在它自己的小节里。

分类的数量和结构由模型按内容决定，没有固定清单。装好时会铺五个起头分类，用不着就删。某一类条目太多，或者里面其实是两件不搭的事，模型会把它拆开。

## ✍️ 三种写入方式

模型工具：模型判断什么值得记，调用 `memoir_note` 写进去，`memoir_recall` 和 `memoir_forget` 用来查和删。

页面手写：点「记一条」，或者直接编辑 md 文件。

自动改写：每轮对话结束、安静 20 秒后，后台把整本读一遍，交出改写后的完整版本。

前两种是追加，第三种是重写。重写才是这套东西的核心，它保证文档不会只涨不消。

## 🔄 自动改写

模型的输入是「记忆册现在的全部内容」加上「这段新对话」，要交出的是改写后的完整版本。合并、删减、改写、新增都在这一步发生。

几条防呆：

- 按会话存游标，只消费上次之后的新事件，同一段不会被反复改写
- 失败不推进游标，下次轮次结束会重试同一段
- 新内容少于 400 字符就跳过，但游标照常推进
- 多个会话同时收尾时请求排队，不会一拥而上
- 解析不出分类就什么都不写；条目总数骤减一半以上（原本不少于 6 条时）直接拒绝这次改写

每条记忆带两个标记。`conf` 是置信度：用户亲口说的是 `high`，从对话里提炼的是 `med`，模型自己推断的是 `low`；要腾地方时先丢 `low`。`pin` 表示钉住，标了它的条目改写时必须原样保留，一篇里最多三五条。

## ⚙️ 设置

页面右上角的齿轮。改动存在记忆库目录的 `.settings.json` 里，跟记忆数据放一起，换 profile 不丢。

写入总开关关掉之后，记忆不再注入提示词、三个工具拒绝执行、页面和 HTTP 写入返回 403、自动改写停止。

改写用的模型从宿主已注册的列表里选。插件调用 `ctx.llm.listProviders()` 和 `ctx.llm.listModels(provider)` 把可选项列成下拉，不用自己填 provider 名和模型 id。DSH 里关联好的模型，不管是自带的、本地的还是第三方 API，都会出现在那里。下拉下面也留了手填的位置。

思考程度默认关闭。改写是整理不是解题，实测思考型模型会把输出预算烧在推理上，正文一个字都吐不出来。

界面语言和记忆语言是两个开关。前者换按钮和标签，后者决定存进 md 的字用哪种语言，包括分类名和小节名。两个都默认英文。

## 🔧 配置

部署级配置走 `cordis.patch.yml`：

```yaml
- id: memoir
  name: '@yansera/dsh-living-memoir'
  config:
    memoryDir: ''              # 留空 = $DSH_HOME/memoir
    injectIndex: true          # 是否把记忆目录注入系统提示词
    maxInjectEntries: 12       # 最多注入几条
    autoDistill: true          # 每轮结束自动改写
    distillDebounceMs: 20000   # 改写前的安静等待（毫秒）
    distillMinChars: 400       # 少于这么多字符就跳过
    distillMaxItems: 60        # 整本条目上限
    distillMaxTokens: 8000     # 输出预算下限，会按记忆规模自动往上抬
    distillReasoningEffort: off # 改写不需要推理
    memoryLanguage: ''         # 记忆内容语言；留空 = 不限制
    pageEntryLimit: 12         # 单类超过这么多条触发强制整理
    bookEntryLimit: 40         # 整本超过这么多条触发强制整理
```

改完要重启，跟代码改动一样。

## 📂 文件长什么样

一个分类一个 md 文件，纯文本，可以用任何编辑器打开，也可以进版本控制。没有数据库，没有缓存，没有私有格式。

条目的元数据写在 HTML 注释里，不影响阅读：

```
- 用户要求所有下载前先问，并说清多少 GB
  <!-- memoir id=8daa8849 | imp=5 | conf=high | at=2026-10-09 | src=用户明确说 | pin -->
```

手工加一行 `- 内容` 就等于加一条记忆。解析器只认三种行：`# 分类`、`## 小节`、`- 条目`，其余全部忽略。

## ❓ 常见问题

**和别的记忆方案冲突吗。** 不冲突。记忆册只管长期宏观那一层：用户是谁、助手是谁、在做什么、定过什么大方向决策。短期与过程性的内容，比如技术细节、踩坑记录、进度流水，不归它管，也不会写进来。数据存在自己的目录里。

**会越记越多吗。** 不会。它是被改写的，长度由内容决定而不是由历史决定。分类超过 12 条或整本超过 40 条会触发强制整理。

**记忆被改错了怎么办。** 每个分类的 md 文件都可以直接改，改完刷新页面就生效。模型下次改写会尊重你改过的分类名。重要条目可以标 `pin` 钉住。

**会外发数据吗。** 不会。插件不主动发起任何网络请求，改写用的是宿主自己的 `llm` 能力。

**能把记忆带走吗。** 能。整个记忆库就是一个目录，拷走就行。

## 🛠 开发

```sh
npm test                # 全部 259 项离线自测
npm run test:store      # 存储层：解析、去重、移动、搜索、注入文本
npm run test:plugin     # host 端：注册面、工具执行、系统提示、HTTP 路由
npm run test:client     # 页面半：用 React 替身渲染真 bundle
npm run test:distill    # 自动改写：输出解析、防抖、游标、失败重试
```

测试全部离线，不依赖 DSH 宿主，也不碰任何真实 profile。

改完源码之后（Windows）：

```powershell
& .\scripts\sync.ps1
```

pnpm 用 `file:` 装本地包时是硬链接，编辑源码会断开链接，安装位置的副本不再更新，所以必须同步再重启。

目录结构：

```
src/       实现本体（index = host 半，distill = 自动改写，client = 页面半）
test/      离线自测
docs/      设计与格式说明
scripts/   同步脚本、对着运行中客户端的冒烟测试
```

细节见 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [docs/](docs/)：[设计说明](docs/design.md)、[存储格式](docs/storage-format.md)、[配置](docs/configuration.md)。

## 📄 许可

[MIT](LICENSE) © Yansera
