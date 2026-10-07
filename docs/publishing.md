# 发布流程

维护者手册：怎么把这个包发到 npm、版本号怎么定、出问题怎么退。

## 前置

- 有 npm 账号，且**用户名是 `yansera`**——scoped 包的命名空间就是用户名。用别的名字也能发，但要把包名和 `cordis.patch.yml` 里的挂载名一起改成 `@<用户名>/dsh-memoir`
- 已 `npm login`
- 工作区干净：`git status` 没有未提交改动
- 全量自测通过：`npm test`（247 项）

## 发一版

```sh
# 1. 定版本号：改 package.json 的 version，同时更新 CHANGELOG.md
# 2. 跑测试
npm test

# 3. 看会发出去什么（这一步很重要，别跳过）
npm pack --dry-run

# 4. 提交并打 tag
git add -A && git commit -m "v1.0.1"
git tag v1.0.1
git push && git push --tags

# 5. 发布
npm publish
```

`publishConfig.access` 已经是 `public`，所以 scoped 包也能被公开安装（npm 只对私有包收费）。

装完之后用户侧是这样：

```sh
dsh plugin --profile desktop add @yansera/dsh-memoir
```

## 版本号怎么定

| 改动 | 版本位 | 例子 |
|---|---|---|
| 只改文档、注释、错误文案 | patch | 1.0.0 → 1.0.1 |
| 新增配置项、新增界面、行为改进 | minor | 1.0.0 → 1.1.0 |
| 改了存储格式、改了已有配置项的语义、破坏兼容 | major | 1.0.0 → 2.0.0 |

**存储格式改动要特别小心**：记忆库是用户的真实数据。真要改格式，必须同时提供迁移路径，并在 CHANGELOG 里写清楚。

## 出问题怎么退

npm 允许在发布后 **72 小时内**撤回：

```sh
npm unpublish @yansera/dsh-memoir@1.0.1
```

超过 72 小时只能标记废弃，然后发一个修好的新版本：

```sh
npm deprecate @yansera/dsh-memoir@1.0.1 "有严重问题，请用 1.0.2"
```

**别删已经发布的版本**——已经装了它的人会拿到一个不存在的依赖，装不上也升不了级。

## 这个包为什么没有构建步骤

`src/` 里的三个文件就是发布内容，`files` 字段直接指向它们。没有 tsconfig、没有打包器、没有原生依赖。

理由：安装路径上任何一环需要构建，都会让「装上去就能跑」变成「先配好工具链」。发布产物等于源码——`npm pack --dry-run` 看到什么，用户就装到什么。

**改动这个前提要慎重**：一旦引入构建步骤，`files` 字段、`main`、CI 和 `sync.ps1` 全都要跟着改。
