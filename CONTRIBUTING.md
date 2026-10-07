# 贡献指南

## 开发环境

- **Node.js ≥ 20.18**（本仓库在 v24 上开发）
- 一个可用的 DeepSeek Harness 客户端（桌面版或 Web 版），用于联调
- ⚠ Windows 上 `scripts/sync.ps1` 必须保持 **UTF-8 with BOM** 编码：Windows PowerShell 5.1 会按 GBK 读没有 BOM 的文件，中文注释会让它直接解析失败

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
npm test                # 全部 199 项
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
