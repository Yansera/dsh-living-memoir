# 配置

所有部署可变项都走 `cordis.patch.yml`（或宿主 profile 里的覆盖层），**代码里没有写死的阈值**。

```yaml
- id: memoir
  name: 'dsh-memoir'
  config:
    memoryDir: ''              # 留空 = $DSH_HOME/memoir
    injectIndex: true
    maxInjectEntries: 12
    autoDistill: true
    distillDebounceMs: 20000
    distillMinChars: 400
    distillMaxItems: 60
    distillMaxTokens: 8000
    distillReasoningEffort: off
    memoryLanguage: ''       # 记忆内容用哪种语言写；留空=不限制

> 第一次运行时的默认值是**英文界面 + 英文记忆**（面向公开分发）；改过就以 `.settings.json` 为准，选「跟随宿主 / 不限制」会如实存成空串。
    pageEntryLimit: 12
    bookEntryLimit: 40
```

## 记忆库

| 配置 | 默认 | 说明 |
|---|---|---|
| `memoryDir` | `''` | 记忆库目录。留空 = `$DSH_HOME/memoir` |

## 系统提示注入

| 配置 | 默认 | 说明 |
|---|---|---|
| `injectIndex` | `true` | 是否把「记忆目录」注入系统提示 |
| `maxInjectEntries` | `12` | 注入时最多带多少条（按重要度取） |

注入是**每次组装实时读盘**的，所以改了记忆文件下一个请求就能看到。没有记忆时这一块不占位置。

## 自动改写

| 配置 | 默认 | 说明 |
|---|---|---|
| `autoDistill` | `true` | 每轮结束自动改写 |
| `distillDebounceMs` | `20000` | 改写前的安静等待（毫秒）。等对话停下来再跑，免得被切碎重复改写，也让 token 花在完整的一段上 |
| `distillMinChars` | `400` | 新增对话少于这么多字符就跳过（游标照常推进） |
| `distillMaxItems` | `60` | 提示模型控制的整本条目上限 |
| `distillMaxTokens` | `8000` | 输出预算**下限**；实际取 `max(这个值, 记忆字数 × 1.2 + 2000)` |
| `distillReasoningEffort` | `off` | 推理档位：`off` 彻底关思考，`low`/`high`/`max` 开启，`none` 不发送该字段 |

### 为什么默认关掉推理

改写是**整理**而不是**解题**：读一堆短句，然后合并、缩写、重排。

实测过：思考型模型会把输出预算烧在推理上，等该吐正文时预算已经没了——表现为「请求成功但正文块一个都没有」，报 `model produced no text`。关掉之后同样的预算全给了正文，一次跑通。

`distillMaxTokens` 之所以是「下限」而不是硬上限：改写要吐出**整本**记忆册，记忆越长要的预算越多。写死一个数，记忆涨到某个规模后就注定说不完。

## 容量触发整理

| 配置 | 默认 | 说明 |
|---|---|---|
| `pageEntryLimit` | 12 | 单个分类超过它就触发强制整理 |
| `bookEntryLimit` | 40 | 整本超过它也触发 |

两条任意踩线，改写 prompt 里就会多一段强制整理令（写明现状 + 要求合并 / 缩略 / 拆小节 + 回落到上限内）。没踩线时不会加。

## 改完要重启

配置改动跟代码改动一样：**热加载只在安装插件那一刻发生**，改完必须重启客户端。
