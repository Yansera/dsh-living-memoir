# 贡献指南

## 开发环境

- **Node.js ≥ 20.18**（本仓库在 v24 上开发）
- 一个可用的 DeepSeek Harness 客户端（桌面版或 Web 版），用于联调
- ⚠ Windows 上 `scripts/sync.ps1` 必须保持 **UTF-8 with BOM** 编码：Windows PowerShell 5.1 会按 GBK 读没有 BOM 的文件，中文注释会让它直接解析失败

### ⚠ 改过 `.ps1` 之后，一定要补回 BOM

大多数编辑器（以及各种自动改写工具）保存时会**丢掉 BOM**。丢了之后脚本仍然"看起来正常"，但一跑就是一串莫名其妙的「意外的标记」——根因只是编码。

补回来的命令：

```powershell
$p = '.\scripts\sync.ps1'
$t = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($p, $t, (New-Object System.Text.UTF8Encoding $true))
```

验证：

```powershell
$b = [System.IO.File]::ReadAllBytes($p)
'{0:X2} {1:X2} {2:X2}' -f $b[0], $b[1], $b[2]   # 要输出 EF BB BF
```

CI 里有一条检查专门盯这个，忘了会被拦下来。

## 目录结构

```
src/       实现本体
  index.js   host 半：存储、工具、系统提示注入、HTTP 路由、配置
  distill.js 自动改写：触发、防抖、游标、prompt、输出解析
  client.js  浏览器半：手写的 ModuleLoader bundle，无构建步骤
test/      离线自测（见下）
docs/      设计与格式说明
scripts/   同步脚本与对着运行中客户端跑的冒烟
```

## 跑测试

```sh
npm test                # 全部 259 项
npm run test:store      # 存储层：解析、去重、移动、搜索、截断、注入文本
npm run test:plugin     # host 端：注册面、工具执行、系统提示、HTTP 路由
npm run test:client     # 页面半：用 React 替身渲染真 bundle，模拟点击并断言请求
npm run test:distill    # 自动改写：输出解析、防抖、游标、失败重试、容量触发
```

测试全部离线：不依赖 DSH 宿主，也不碰任何真实 profile。跑之前需要在包目录下能解析到 `@deepseek-ai/schemastery` 与 `@deepseek-ai/dsh-tools`（装进 profile 后天然满足）。

另有一个**对着运行中的客户端**跑的冒烟，会真的写一条再删掉：

```sh
npm run smoke                              # 默认打 127.0.0.1:19387
node scripts/smoke-live.mjs http://127.0.0.1:3080   # 换端口（Web 端）
```

## 改完代码之后

pnpm 用 `file:` 装本地包时是**硬链接**，用编辑器改写源文件会断开链接，安装位置的副本就不再更新。所以改完源码要跑：

```powershell
& .\scripts\sync.ps1                # 同步到 desktop
& .\scripts\sync.ps1 -Profile web   # 同步到 web
```

它只复制真正变化的文件，并提醒你重启客户端 —— **热加载只在安装插件那一刻发生**，之后改文件客户端不认。

## 加一种界面语言

界面文案在 `src/client.js` 顶部的 `DICTS` 里，每种语言一个对象。加一种语言四步：

1. **补字典**：照着 `zh` 复制一份，值换成目标语言。**键一个都不能少**——缺的键会回落到宿主语言，界面上会突然冒出别的语言
2. **注册**：`DICTS` 里加一项（键就是语言代码，如 `it`）
3. **设置面板**：`settingsView` 的「界面语言」下拉里加一个 `<option>`
4. **README**：新建 `README.<code>.md`，并在**全部** README 顶部的语言导航里互链

**翻译注意**：

- 界面文案要短——按钮和标签本来就窄
- `langAuto` 是「跟随宿主」的意思，不是某个语言的名字
- 术语保持一致：category 分类 / section 小节 / entry 条目
- 中英混排的标点跟着目标语言走（法语用不换行空格，德语用 „ “ 引号）

## ⚠ 改包名时，`src/client.js` 的 bundle id 必须一起改

这是实测踩过的坑，代价是**整个客户端起不来**：

```
client-modules: duplicate factory registration for "dsh-memoir"
web boot: 1 entry did not activate
@yansera/dsh-memoir: import failed
```

`src/client.js` 第一行声明的 `id` 会被 client-modules 当作 factory 的注册键，**它必须等于 `package.json` 的 `name`**。两者不一致时注册键对不上，浏览器半直接装配失败——而且失败发生在启动阶段，整个界面都渲染不出来（侧边栏、会话列表全是空的，看起来像数据丢了，其实只是没渲染）。

对照：已发布的 scoped 插件，bundle id 就是它们各自的完整包名（`@scope/name` 形式）。

所以改包名时，除 `package.json` / `cordis.patch.yml` / README / `scripts/sync.ps1` 之外，**别忘了 `src/client.js` 的 `id`**，并同步更新 `test/client.test.mjs` 里对应的断言。

## 提交约定

- 一个提交只做一件事，信息用祈使句写清「做了什么」。
- 改了用户可见的行为就更新 `CHANGELOG.md` 的 `[未发布]` 段。
- **新增配置项必须同时更新三处**：`cordis.patch.yml`（默认值）、`README.md` 的配置表、`src/index.js` 里 `Config` 的字段注释。

## 代码风格

- ESM，`"type": "module"`，本地相对导入带 `.js` 后缀。
- 每个模块和导出的函数都有 JSDoc，写清**契约**（前置条件、返回值、副作用），不要复述控制流。
- 注释解释**为什么**，不解释**做了什么**。踩过的坑要写清症状与根因，方便下一个人不再踩。
- **不引入原生依赖，也不引入构建步骤** —— 这个包的价值之一就是「装上去就能跑」。
- 中文注释与中文文档是本仓库的默认语言。
