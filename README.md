# dsh-expert-team

一个可复用的 DSH 专家团队工作流：**用户只给调度师目标**，调度师自己评估任务、决定需要哪些专家、创建助手、建任务并按顺序派发。调度师拥有团队内的最高权限，可以在进行中开新助手、废弃旧助手、暂时停止助手、决定何时压缩上下文；但**用户的权限始终高于调度师**，可以随时介入或直接和任意助手对话。

## 使用

1. 新建会话，在 Agent preset 选择器里选择 **专家团队**。选中后输入框上方会出现目标卡片；这是唯一的入口，不再额外放重复的「专家团队」按钮。
2. 在目标卡片里填写**目标**，点击「开始评估并组建团队」。也可以直接在输入框里写目标，专家团队的调度师提示词同样生效。
3. 调度师先给出一段分工计划，然后为每个助手调用 `expert_team_open`（可指定模型）或 `spawn_teammate`，用 `team_task_create` 建任务、用 `send_message` 按顺序派发。
4. 输入框上方的**事件树**会实时显示每位助手的运行状态、当前任务、所用模型和最近事件；右侧是**派发序列**。
5. 你随时可以介入：
   - 直接对调度师说「再开一个负责 X 的助手」「废弃 Y」「暂时停一下 Z」「压缩上下文」；
   - 或**点击事件树里的任意助手**，打开它的会话，看它到底做了什么，并直接对话。直接对话会唤醒它；如果它已被调度师废弃，你的直接消息会把它恢复。

## 选择助手模型

- 调度师先调用 `expert_team_models`。它会列出 DSH 当前已配置的 LLM provider 与模型；没有 LLM 服务或没有模型时返回提示，调度师不会追问用户，直接用默认模型。
- 需要区分模型时，调用 `expert_team_open`，传 `provider`、`model` 以及可选 `reasoning_effort`。Host 会先用 `ctx.llm.resolveCallConfig()` 预检，再创建助手。
- 创建后立刻对新助手的 `agent.model.select()` 设置模型。因为 Team `spawnTeammate` 会先让助手跑一次“确认就位”，所以**模型从下一步（真正的任务）生效**；这一步很短，默认模型成本可忽略。
- 如果模型预检失败，不会创建助手；如果创建后模型切换失败，助手仍保留在默认模型上，工具结果返回 `modelSelected: false` 和 `modelError`，调度师可继续用默认模型或裁掉该助手。
- 事件树里的助手节点会显示选中的模型；如果模型未切换，会显示黄色模型标记。

## 事件树的状态颜色

| 颜色 | 含义 | 判定 |
|---|---|---|
| 🟢 绿色闪烁 | 正在运行 | 该 Agent 当前有运行中的轮次 |
| 🟡 黄色 | 阻塞或等待 | 有未就绪的依赖任务、正在等待其他助手回复、或已就绪但还没被派发 |
| 🔴 红色 | 暂时停止 | 调度师调用过 `interrupt_agent`，或创建/运行失败；下一条消息或下一次运行会恢复 |
| ⚪ 灰色 | 已废弃 | 调度师调用 `expert_team_close` 废弃了它；仍可点开历史会话，用户直接对话可恢复 |
| ⚪ 空心 | 待命 | 没有运行、没有阻塞任务、没有待处理请求 |

事件树里每个节点显示：状态色点、代号、状态文字、当前任务/等待原因、职责、以及最近 4 条事件（用户干预、任务、成员、点对点消息、通知）。调度师节点也会显示它的最近事件。

## 用户高于调度师

- 用户的任何新消息都优先于调度师的计划和任务板；调度师必须立即调整，不能坚持原计划。
- 用户可以直接打开任意助手的会话并对话；助手收到用户直接指令时先执行，并把关键变化告知调度师。
- 用户直接给已废弃/暂时停止的助手发消息，会清除废弃/停止标记，让它恢复运行。
- 调度师的写工具被禁用，所有实现工作必须由助手完成；用户可以直接要求调度师调整分工或亲自指挥助手。

## 调度师的权限

| 能力 | 实现 |
|---|---|
| 自行决定团队组成 | 首次收到目标时评估，不要求用户挑选助手 |
| 进行中开新助手 | `expert_team_open`（可指定 provider/model/reasoning_effort）或内置 `spawn_teammate`（不选模型） |
| 选择助手模型 | 先 `expert_team_models` 看 DSH 已配置的 provider/model，再用 `expert_team_open` 指定；没有配置就用默认；模型从助手的下一步生效 |
| 废弃旧助手 | `expert_team_close`：停止当前轮次、释放其任务、在事件树标记已废弃 |
| 暂时停止 | 内置 `interrupt_agent`：停止当前轮次但保留队列；事件树变红，下一条消息恢复 |
| 压缩上下文 | `expert_team_compact`：默认压缩调度师自己，传 `target` 可压缩某个助手 |
| 调整任务 | 内置 `team_task_*` 工具；废弃助手时会把其名下未完成任务释放回任务板 |
| 事件通知 | 任务完成时自动通知依赖方/请求方和调度师，见下节 |
| 不直接改代码 | Host 侧的写工具守卫会拒绝调度师的 `write` / `edit` / `apply_patch` / `bash` / `pwsh` |

「废弃」不会删除 Team roster 里的名字（Agent Teams 的名字不可复用），但会停止该助手、释放任务、标记为已废弃，并阻止调度师再给它发消息或改派任务。需要新领域时用新名字创建新助手。Team 的成员上限已调到 24，足够做多轮开/废。

## 事件通知：A 等 B，B 完成会叫醒 A

这是工作流效率的核心：

1. A 助手用 `send_message` 向 B 请求资源/接口，A 随后可能进入空闲。
2. Host 插件记录 A → B 的待处理请求（消息台账），同时任务板可以表达 A 的任务依赖 B 的任务。
3. B 完成任务时，Team 日志出现 `team/task` 的 completed 记录。Host 插件自动找出：
   - 依赖该任务的助手（`blockedBy` 包含该任务）；
   - 最近向 B 发出请求、尚未收到回复的助手；
   - 调度师。
4. 以 B 的身份（B 的 Agent 仍在线时）调用 Team `send_message`，向这些助手和调度师发送「任务完成」通知；B 不在线时由调度师代发。
5. 通知会唤醒空闲的 A（或冷恢复它），A 收到后继续执行。调度师也会收到完成通知，不需要反复轮询。

通知是普通 Team peer 消息，会出现在目标助手的对话和事件树里；不会绕过 Team 的权限检查。

## 工作流是怎么接起来的

1. **Agent preset**：`专家团队` 把标准工具集装进会话，并加上团队角色前缀。选中它后，调度师提示词会在 Agent 创建/首步之前安装，即使还没有任何助手。
2. **目标卡片**：浏览器半只收集目标，生成一条格式固定的用户消息：
   ```
   专家团队初始化
   目标：
   ...
   请调度师先评估目标，决定需要哪些专家，自行创建助手并组建团队，然后建任务、按顺序派发。
   ```
3. **Host 首步门**：`agent/pre-step` 识别这条消息，把会话标记为专家团队模式并安装：
   - 调度师 system prompt section（含用户更高权限、组队流程、开/废/停/压缩说明）；
   - 写工具守卫；
   - Lead-only 的 `expert_team_close` 与 `expert_team_compact`。
   插件**不会**替调度师预先创建助手——组队完全由调度师决定。
4. **Agent Teams**：启用随 DSH 提供的 `@deepseek-ai/dsh-experimental-agent-team`、工具包和 Web UI。助手创建、任务板、点对点消息、等待都由官方 Team 协议完成。
5. **Host 事件台账**：`session/event` 把用户干预、peer 消息、任务/成员事件、废弃/停止/压缩通知写入有界台账；`team/task` 完成时触发通知分发。
6. **模型选择**：`expert_team_models` 从 Host `ctx.llm` 读取已配置的 provider/model；`expert_team_open` 预检后在 Agent 创建完成时调用其 `model.select()`，模型从下一次请求生效。
7. **浏览器半**：从共享的 `agentTeam` Session projection 读取 roster 与任务板（无需轮询）；从只读路由 `/dsh-expert-team/ledger` 读取目标、事件、消息、待处理请求、废弃/停止标记和选中的模型（约 2.5 秒轮询一次）。点击助手节点通过 `uiWorkspace.openSession` 打开其 continuable 子会话。

## 安装

### 从 npm（发布后）

```sh
dsh plugin --profile <profile> add dsh-expert-team
```

也可以在 Web/Desktop 的 Plugin Manager 里安装 bundle，包名填 `dsh-expert-team`。

### 从源码

```sh
git clone https://github.com/3493750852/dsh-expert-team.git
```

然后在 Plugin Manager 里用 `install_bundle` 指向仓库目录的绝对路径；本地联调时这是最直接的方式。

安装后刷新页面。若只改了 `client.js`，Host 会在重载后请求客户端模块图重新发布；仍然看不到新 UI 时刷新一次页面。

## 配置

`cordis.patch.yml` 中本插件行只有：

```yaml
- id: dsh-expert-team
  name: dsh-expert-team
  config:
    freshProvider: spawn
```

- `freshProvider`：`spawn_teammate` 使用的 subagent provider，默认 `spawn`。
- Team 服务本身的上限在本 patch 里：`maxMembers: 24`、`maxTasks: 256`。

## 已知限制

- **废弃不是删除**：Team roster 不可删除、名字不可复用；废弃是「停止 + 释放任务 + 标记 + 禁止再派发」。上限 24 个成员按历史成员累计计算。
- **状态色是派生值**：绿色来自 Agent 实时运行状态；黄色来自任务依赖/待处理请求；红色来自 `interrupt_agent` 或失败标记；灰色来自废弃台账。它们不是 Team 领域的持久状态，刷新后由台账恢复。
- **通知的请求侧是启发式**：任务依赖是精确的；「最近向 B 发过消息的 A」是便捷判断。如果 A 只是随便聊天，B 完成时也可能收到一条完成通知，但不会影响任务板。
- **模型选择从下一步生效**：Team 的 `spawnTeammate` 会先让新助手跑一条“确认就位”，模型在 Agent 发布后才通过 `model.select()` 切换，所以这条确认消息可能仍用默认模型；真正的任务从下一步开始用选中的模型。DSH 没有配置 LLM/模型时，工具返回提示，助手使用默认模型。
- **共享工作目录**：所有助手共享同一个 cwd；写入范围只是提示，不是锁。调度师需要在任务里写清允许触及的路径，并在最后检查 diff/测试结果。
- **压缩的服务归属**：`expert_team_compact` 使用目标 Agent 自己的 preset 侧 `compaction` 服务；没有 compaction 的 preset 会返回明确错误。
- **事件台账是显示缓存**：完整对话仍以各 Session 日志为准；本插件保留每队最多 400 条事件、300 条消息、每条最多 1200 字。
- **页面刷新**：客户端插件是安装包里的静态 bundle；Host 重载后不一定自动替换已加载的浏览器模块，刷新页面最稳。

## 文件

| 文件 | 作用 |
|---|---|
| `cordis.patch.yml` | 启用 Team 服务/工具/UI，插入 Host 插件与 `专家团队` preset |
| `index.js` | 目标门、调度师 prompt/守卫、开助手/选模型、废弃/压缩工具、事件台账、完成通知、ledger 路由 |
| `client.js` | 目标卡片、事件树（状态色/事件/点击进会话）、派发序列 |
| `test/host-smoke.mjs` | 目标解析、调度师 section、写守卫、废弃、压缩、preset 检测 |
| `test/event-smoke.mjs` | 完成通知、暂时停止/恢复、用户恢复废弃助手、事件台账 |
| `test/model-smoke.mjs` | 模型目录、指定模型、默认回退、无 LLM 服务 |
| `locale/*.json` | 插件页标题与说明 |

## 验证

```powershell
node --check index.js
node --check client.js
npm test
```

`npm test` 会依次跑 Host、事件通知、模型选择三个 smoke test。浏览器视觉验证需要在已登录的 DSH 页面刷新后确认；当前验证覆盖 JavaScript 语法、manifest/插槽注册和 Host 工作流冒烟测试。

## License

MIT。见 [LICENSE](LICENSE)。
