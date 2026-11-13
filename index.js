/**
 * dsh-expert-team — Host half.
 *
 * The browser half asks the user for one thing only: the goal. The user does
 * not choose the team. The dispatcher (Team Lead) evaluates the goal, decides
 * which experts it needs, creates them itself with `spawn_teammate`, builds the
 * task board, and assigns the work.
 *
 * This Host plugin makes that role real:
 *   - a dispatcher system-prompt section, installed for the expert-team preset
 *     (and for a goal-only kickoff message in any session);
 *   - a write guard so the dispatcher cannot do the implementation itself;
 *   - Lead-only tools to close a teammate and to compact a context; and
 *   - a small read-only ledger so the browser tree can show peer messages and
 *     the closed/active state of each expert.
 *
 * Spawning, task creation, peer messages, and waiting are the shipped Agent
 * Teams protocol. The browser reads the shared `agentTeam` Session projection
 * for the roster and task board.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const name = 'dsh-expert-team'

/** Hard services used for the per-Agent prompt/guard and the read-only route. */
export const inject = ['agents', 'systemPrompt', 'tools']

const DEFAULTS = {
  /** Subagent provider used by the Lead's spawn_teammate calls. */
  freshProvider: 'spawn',
}

const MUTATING_TOOLS = new Set(['write', 'edit', 'apply_patch', 'bash', 'pwsh'])
const SECTION_NAME = 'expert-team/dispatcher'
const SECTION_ORDER = 120
const LEDGER_VERSION = 1
const MAX_MESSAGES_PER_TEAM = 300

/**
 * Read and normalize the bundle row config.
 * @param {unknown} config
 */
function readOptions(config) {
  const raw = config && typeof config === 'object' ? config : {}
  const freshProvider =
    typeof raw.freshProvider === 'string' && raw.freshProvider.trim().length > 0
      ? raw.freshProvider.trim()
      : DEFAULTS.freshProvider
  return { freshProvider }
}

/** @param {string} text @param {number} limit */
function clip(text, limit) {
  const value = String(text ?? '')
  return value.length <= limit ? value : value.slice(0, limit - 1) + '…'
}

/** @param {unknown} content */
function textOf(content) {
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const block of content) {
    if (block && block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  return parts.join('\n')
}

/** @param {string} text */
function stripTeamPrefix(text) {
  return String(text ?? '').replace(/^Team message from [^:\n]+:\s*/u, '').trim()
}

/** @param {string} file */
function loadLedger(file) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (
      raw &&
      raw.version === LEDGER_VERSION &&
      raw.teams &&
      typeof raw.teams === 'object' &&
      !Array.isArray(raw.teams)
    ) {
      return raw
    }
  } catch {
    // Missing or corrupt ledgers are normal on first run; start clean.
  }
  return { version: LEDGER_VERSION, seq: 0, teams: {} }
}

/** @param {import('node:http').ServerResponse} res @param {number} status @param {unknown} body */
function sendJson(res, status, body) {
  try {
    const text = JSON.stringify(body)
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(text),
    })
    res.end(res.req?.method === 'HEAD' ? undefined : text)
  } catch {
    try {
      res.writeHead(500)
      res.end()
    } catch {
      // The socket may already be gone.
    }
  }
}

/**
 * Parse the goal-only kickoff block produced by client.js. Legacy blocks that
 * still contain a "需要的助手：" section are accepted, but the roles are ignored:
 * the dispatcher owns the team composition now.
 * @param {Array<{ content?: unknown }>} messages
 * @returns {{ goal: string } | null}
 */
function parseKickoff(messages) {
  if (!Array.isArray(messages)) return null
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const text = textOf(messages[index]?.content)
    if (!text || !/^专家团队初始化\s*$/mu.test(text)) continue
    const lines = text.split(/\r?\n/u)
    const titleIndex = lines.findIndex((line) => line.trim() === '专家团队初始化')
    if (titleIndex < 0) continue
    const goalIndex = lines.findIndex(
      (line, lineIndex) => lineIndex > titleIndex && line.trim() === '目标：',
    )
    if (goalIndex < 0) continue

    let endIndex = lines.length
    for (let lineIndex = goalIndex + 1; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex].trim()
      if (line === '需要的助手：' || /^请调度师/u.test(line)) {
        endIndex = lineIndex
        break
      }
    }
    const goal = lines
      .slice(goalIndex + 1, endIndex)
      .join('\n')
      .trim()
    if (!goal) continue
    return { goal }
  }
  return null
}

/**
 * Resolve the tool arguments. The guard is synchronous and may receive either
 * the parsed value or a JSON string depending on the caller.
 * @param {{ arguments?: unknown }} execution
 */
function toolArguments(execution) {
  const value = execution?.arguments
  if (value && typeof value === 'object') return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * Wait for a promise, but never longer than `ms`.
 * @template T
 * @param {Promise<T> | T} value
 * @param {number} ms
 * @returns {Promise<T | undefined>}
 */
function bounded(value, ms) {
  let timer
  return Promise.race([
    Promise.resolve(value).finally(() => {
      if (timer) clearTimeout(timer)
    }),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(undefined), ms)
      try {
        timer.unref?.()
      } catch {
        // Browserless runtimes may not implement unref.
      }
    }),
  ])
}

/**
 * @param {string} goal
 * @param {Array<{ name: string, role: string, description?: string }>} members
 * @param {Record<string, { at?: number, reason?: string }>} closed
 */
function buildDispatcherPrompt(goal, members, closed) {
  const teammates = (members || []).filter((member) => member.role === 'teammate')
  const active = teammates.filter((member) => !closed?.[member.name])
  const closedNames = teammates
    .filter((member) => closed?.[member.name])
    .map((member) => member.name)
  const roster =
    active.length === 0
      ? '（暂无在役助手；首次评估时由你决定并创建）'
      : active
          .map(
            (member) =>
              `- ${member.name}：${member.description || '（未填写职责，请先补全）'}`,
          )
          .join('\n')

  return [
    '你是本会话的调度师（Team Lead），也是用户默认直接对话的人。',
    '你拥有团队内的最高权限；但用户的权限高于你：用户随时可以介入、改变目标、直接指挥任何助手，或打开某个助手的会话直接对话。用户的新指令优先于你的计划和任务板，收到后立即调整，不要坚持原计划。',
    '你可以随时创建新助手、关闭旧助手、暂时停止助手、调整任务和压缩上下文；助手不能自行创建或关闭成员。',
    `团队目标：${goal || '（等待用户给出目标）'}`,
    '当前在役助手：',
    roster,
    closedNames.length > 0
      ? `已废弃助手（不要给它们发消息或分配任务）：${closedNames.join(', ')}`
      : '',
    '',
    '用户只提供目标；团队组成由你评估决定，不要让用户挑选助手。',
    '首次收到目标时：',
    '1. 分析目标、约束、验收标准与依赖；',
    '2. 决定需要哪些领域、多少名助手（不必套用固定角色，按实际需要）；',
    '3. 对每个助手优先调用 expert_team_open：name 用小写代号，description 写清职责；如果需要区分模型，先调用 expert_team_models 看已配置的 provider/model，再把 provider、model（可选 reasoning_effort）传给 expert_team_open。没有可用模型就省略模型字段，用默认即可，不要问用户。expert_team_open 会先让助手确认就位，模型从下一步生效。没有模型需求时也可以用 spawn_teammate；',
    '4. 为每个助手用 team_task_create 建任务，写清交付物、验收标准与允许触及的路径；',
    '5. 按任务顺序用 send_message 逐个派发；能并行的并行，有依赖的用 wait_agent 等待。',
    '',
    '模型选择：expert_team_models 会列出 DSH 已配置的 LLM 路由；按任务需要给助手选模型（例如推理强的做架构/疑难，快的做批量机械工作，便宜的做简单整理）。模型只影响该助手，不影响你和其他助手；expert_team_open 返回 modelSelected 表示是否成功切换，模型从下一步生效。如果选模型失败，按工具结果用默认模型继续，不要卡在选模型上。',
    '',
    '运行中的权限：',
    '- 发现新领域或瓶颈时，随时 expert_team_open 开新助手（可指定模型）或 spawn_teammate，并给它建任务；',
    '- 助手不再需要时，调用 expert_team_close 关闭它；关闭会停止其当前轮次、释放其任务；名字不复用，新助手请用新名字；',
    '- 只想让助手先停下、稍后再继续时，调用 interrupt_agent 暂时停止它；之后 send_message 会重新唤醒它；',
    '- 上下文过长、完成一个大阶段或准备进入下一阶段时，调用 expert_team_compact 压缩上下文；传 target 可压缩某个助手；',
    '- 不要给已废弃的助手发消息或分配任务；用户直接在会话里恢复的助手除外。',
    '',
    '事件通知：助手之间用 send_message 请求资源或对齐接口。某个任务完成时，系统会自动通知依赖它的助手、最近向负责人发出请求的助手，以及你；你也可以主动 send_message 确认交付。依赖未完成的助手会在团队树里显示为阻塞/等待。',
    '',
    '你不直接修改文件、不执行写命令；写工具已被禁用。所有实现交给助手。',
    '用户只与你对话：把进展压缩成一两句话同步给用户，不要粘贴大段日志。全部任务完成后核对任务板，汇总交付物与验证结果。',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * @param {import('node:fs').PathLike} file
 * @param {object} value
 */
function writeLedger(file, value) {
  const dir = path.dirname(String(file))
  fs.mkdirSync(dir, { recursive: true })
  const temp = `${file}.tmp-${process.pid}`
  fs.writeFileSync(temp, JSON.stringify(value), 'utf8')
  fs.renameSync(temp, file)
}

const CLOSE_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    target: { type: 'string' },
    alreadyClosed: { type: 'boolean' },
    interrupted: { type: 'string' },
    releasedTasks: { type: 'array', items: { type: 'string' } },
    errors: { type: 'array', items: { type: 'string' } },
  },
  required: ['ok', 'target'],
}

const COMPACT_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    target: { type: 'string' },
    compacted: { type: 'boolean' },
  },
  required: ['ok', 'target', 'compacted'],
}

const OPEN_OUTPUT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    name: { type: 'string' },
    id: { type: 'string' },
    provider: { type: 'string' },
    model: { type: 'string' },
    reasoning_effort: { type: 'string' },
    modelSelected: { type: 'boolean' },
    modelError: { type: 'string' },
  },
  required: ['ok', 'name', 'modelSelected'],
}

/**
 * Lead-only discovery of the configured LLM routes. Returns plain text so the
 * dispatcher can decide whether a model choice is worthwhile; without an LLM
 * service it returns a short "none" line and the team keeps the default model.
 * @param {{ id: string }} agent
 * @param {{ getLlm: Function }} helpers
 */
function modelsToolDefinition(agent, helpers) {
  return {
    name: 'expert_team_models',
    description:
      '列出 DSH 当前已配置的 LLM provider 与模型，用于给新助手选模型。只传 provider 时列出该 provider 的模型；不传则列出全部。没有配置模型或没有 LLM 服务时返回提示；不要向用户询问模型，省略模型用默认即可。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        provider: {
          type: 'string',
          description: '可选的 provider id；省略时列出全部 provider 和模型。',
        },
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    async execute(args, exec) {
      const llm = helpers.getLlm()
      if (!llm?.listProviders) return '(no LLM service configured)'
      const providers = llm.listProviders() || []
      if (providers.length === 0) return '(no LLM providers configured)'
      const wanted = typeof args?.provider === 'string' ? args.provider.trim() : ''
      const lines = []
      for (const provider of providers) {
        if (wanted && provider.id !== wanted) continue
        lines.push(`${provider.id} — ${provider.name || provider.id}`)
        let models = []
        try {
          models = (await llm.listModels(provider.id)) || []
        } catch (error) {
          lines.push(`  (models unavailable: ${clip(String(error?.message || error), 160)})`)
          continue
        }
        if (models.length === 0) {
          lines.push('  (no models)')
          continue
        }
        for (const model of models.slice(0, 20)) {
          lines.push(
            `  ${provider.id}/${model.id} — ${clip(model.name || model.id, 80)}${
              model.description ? `: ${clip(model.description, 140)}` : ''
            }`,
          )
        }
        if (models.length > 20) lines.push(`  … ${models.length - 20} more`)
        exec?.signal?.throwIfAborted?.()
      }
      return lines.length > 0 ? lines.join('\n') : `(no models for provider ${wanted})`
    },
  }
}

/**
 * Lead-only spawn with optional model selection. The teammate is created with a
 * short "report ready" prompt; the model is selected immediately after the
 * child Agent is published, so it applies from the next turn.
 * @param {{ id: string }} agent
 * @param {object} helpers
 */
function openToolDefinition(agent, helpers) {
  return {
    name: 'expert_team_open',
    description:
      '创建一个新的专家助手，并可选地指定模型。会先让助手确认就位；模型从下一步生效，随后用 send_message 派任务。只有调度师可以调用。创建前可先调用 expert_team_models 查看已配置模型；没有可用模型就省略 provider/model 用默认。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: {
          type: 'string',
          description: '唯一的小写代号，只能包含 a-z、0-9 和连字符。',
        },
        description: {
          type: 'string',
          description: '职责说明，会显示在事件树和 roster 里。',
        },
        provider: {
          type: 'string',
          description: '可选 provider id，来自 expert_team_models；必须与 model 一起提供。',
        },
        model: {
          type: 'string',
          description: '可选模型 id，来自 expert_team_models；必须与 provider 一起提供。',
        },
        reasoning_effort: {
          type: 'string',
          description: '可选推理强度 id；省略使用适配器默认值。',
        },
      },
      required: ['name', 'description'],
    },
    output: {
      schema: OPEN_OUTPUT,
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      const name = String(args?.name || '').trim().toLowerCase()
      const description = clip(String(args?.description || '').trim(), 200)
      const provider = typeof args?.provider === 'string' ? args.provider.trim() : ''
      const model = typeof args?.model === 'string' ? args.model.trim() : ''
      const reasoningEffort =
        typeof args?.reasoning_effort === 'string' ? args.reasoning_effort.trim() : ''
      if (!/^[a-z][a-z0-9-]{0,23}$/u.test(name)) {
        throw new Error('name 必须是小写字母开头的代号（a-z、0-9、-，最多 24 字符）')
      }
      if (!description) throw new Error('description 不能为空')
      if ((provider && !model) || (!provider && model)) {
        throw new Error('provider 和 model 必须同时提供，或同时省略')
      }
      const teams = helpers.teamService()
      if (!teams?.spawnTeammate) throw new Error('团队服务不可用')

      if (provider && model) {
        const llm = helpers.getLlm()
        if (!llm?.resolveCallConfig) {
          throw new Error('LLM 服务不可用；省略 provider/model 使用默认模型')
        }
        await llm.resolveCallConfig(
          {
            provider,
            model,
            ...(reasoningEffort ? { reasoningEffort } : {}),
          },
          exec?.signal,
        )
      }

      const promptText = `你是专家团队中的「${description}」助手（代号 ${name}）。调度师会给你任务。现在只回复“已就位，等待任务”，不要开始执行。`
      const spawned = await teams.spawnTeammate(agent, {
        name,
        description,
        prompt: [{ type: 'text', text: promptText }],
        context: 'fresh',
        provider: helpers.getFreshProvider(),
        signal: exec?.signal,
      })
      const member = spawned?.member || spawned || {}
      const row = helpers.ensureLedger(String(agent.id))
      row.roles = Array.isArray(row.roles) ? row.roles : []
      if (!row.roles.some((role) => role.name === name)) {
        row.roles.push({ name, title: description, brief: description })
      }

      let modelSelected = false
      let modelError = ''
      if (provider && model) {
        try {
          const child = await helpers.waitForAgent(member.id, 1000)
          if (!child?.model?.select) throw new Error('child agent model selector unavailable')
          await child.model.select({
            provider,
            model,
            ...(reasoningEffort ? { reasoningEffort } : {}),
          })
          modelSelected = true
        } catch (error) {
          modelError = clip(String(error?.message || error), 300)
        }
        row.models[name] = {
          provider,
          model,
          ...(reasoningEffort ? { reasoningEffort } : {}),
          at: Date.now(),
          selected: modelSelected,
        }
      }

      row.updatedAt = Date.now()
      helpers.pushEvent(row, {
        kind: 'member',
        from: 'lead',
        to: name,
        text: `新助手 ${name} 就绪${
          provider && model
            ? ` · ${provider}/${model}${modelSelected ? '' : '（模型未切换）'}`
            : ''
        }`,
      })
      helpers.scheduleSave()
      helpers.ensureDispatcher(agent)
      return {
        ok: true,
        name,
        ...(member.id ? { id: String(member.id) } : {}),
        ...(provider ? { provider } : {}),
        ...(model ? { model } : {}),
        ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
        modelSelected,
        ...(modelError ? { modelError } : {}),
      }
    },
  }
}

/**
 * @param {{ id: string }} agent
 * @param {{ teamService: Function, membersOf: Function, ensureLedger: Function, scheduleSave: Function, ensureDispatcher: Function, getSubagents: Function, getAgents: Function, log: Function }} helpers
 */
function closeToolDefinition(agent, helpers) {
  return {
    name: 'expert_team_close',
    description:
      '关闭一个不再需要的专家助手。会停止它当前的轮次、释放它名下的任务，并在团队面板标记为已关闭。只有调度师可以调用。关闭后名字不能复用；需要新领域时用 spawn_teammate 创建新助手。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        target: {
          type: 'string',
          description: '要关闭的助手代号，来自 list_agents。',
        },
        reason: {
          type: 'string',
          description: '关闭原因，用于团队面板。',
        },
      },
      required: ['target'],
    },
    output: {
      schema: CLOSE_OUTPUT,
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args) {
      const target = String(args?.target || '').trim()
      if (!target) throw new Error('target 不能为空')
      if (target === 'lead') throw new Error('不能关闭调度师')
      const teams = helpers.teamService()
      if (!teams?.interrupt) throw new Error('团队服务不可用')
      const members = helpers.membersOf(agent)
      const member = members.find(
        (candidate) => candidate.name === target && candidate.role === 'teammate',
      )
      if (!member) throw new Error(`找不到助手：${target}`)

      const row = helpers.ensureLedger(String(agent.id))
      row.closed = row.closed && typeof row.closed === 'object' ? row.closed : {}
      if (row.closed[target]) {
        return {
          ok: true,
          target,
          alreadyClosed: true,
          interrupted: 'inactive',
          releasedTasks: [],
          errors: [],
        }
      }

      const errors = []
      let interrupted = 'inactive'
      try {
        const result = teams.interrupt(agent, target)
        interrupted = String(result?.previousStatus || 'inactive')
      } catch (error) {
        errors.push(`interrupt: ${clip(String(error?.message || error), 200)}`)
      }

      try {
        const subagents = helpers.getSubagents()
        if (subagents?.drainChildren) {
          await bounded(subagents.drainChildren(agent, [member.id]), 5000)
        }
      } catch (error) {
        errors.push(`drain: ${clip(String(error?.message || error), 200)}`)
      }

      const releasedTasks = []
      try {
        const tasks = teams.listTasks(agent) || []
        for (const task of tasks) {
          if (task.ownerName !== target) continue
          if (task.status !== 'pending' && task.status !== 'in_progress') continue
          try {
            await teams.updateTask(agent, {
              taskId: task.id,
              expectedRevision: task.revision,
              action: 'release',
            })
            releasedTasks.push(task.id)
          } catch (error) {
            errors.push(
              `${task.id}: ${clip(String(error?.message || error), 200)}`,
            )
          }
        }
      } catch (error) {
        errors.push(`tasks: ${clip(String(error?.message || error), 200)}`)
      }

      row.closed[target] = {
        at: Date.now(),
        reason: clip(String(args?.reason || ''), 300),
      }
      row.updatedAt = Date.now()
      if (helpers.pushEvent) {
        helpers.pushEvent(row, {
          kind: 'notice',
          from: 'lead',
          to: target,
          text: `废弃助手 ${target}${args?.reason ? `：${clip(String(args.reason), 200)}` : ''}`,
        })
      }
      helpers.scheduleSave()
      helpers.ensureDispatcher(agent)
      return {
        ok: true,
        target,
        alreadyClosed: false,
        interrupted,
        releasedTasks,
        errors,
      }
    },
  }
}

/**
 * @param {{ id: string }} agent
 * @param {{ membersOf: Function, ensureLedger: Function, getAgents: Function, getCompaction: Function }} helpers
 */
function compactToolDefinition(agent, helpers) {
  return {
    name: 'expert_team_compact',
    description:
      '立即压缩上下文。默认压缩调度师自己的上下文；传 target 可压缩某个助手的上下文。上下文很长、完成一个大阶段或准备开始下一阶段时使用。只有调度师可以调用。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        target: {
          type: 'string',
          description: '要压缩的成员代号；省略表示调度师自己。',
        },
        reason: {
          type: 'string',
          description: '压缩原因，便于在对话里说明。',
        },
      },
    },
    output: {
      schema: COMPACT_OUTPUT,
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      const target = String(args?.target || 'lead').trim() || 'lead'
      let targetAgent = agent
      if (target !== 'lead') {
        const members = helpers.membersOf(agent)
        const member = members.find(
          (candidate) => candidate.name === target && candidate.role === 'teammate',
        )
        if (!member) throw new Error(`找不到助手：${target}`)
        const row = helpers.ensureLedger(String(agent.id))
        if (row.closed?.[target]) {
          throw new Error(`助手 ${target} 已关闭，不能再压缩其上下文`)
        }
        targetAgent = helpers.getAgents()?.get(member.id)
        if (!targetAgent) {
          throw new Error(`助手 ${target} 当前不在运行；先发消息唤醒它，再压缩`)
        }
      }

      const compaction =
        targetAgent.ctx?.get?.('compaction') || helpers.getCompaction()
      if (!compaction?.compactNow) {
        throw new Error('压缩服务不可用（当前 preset 未挂载 compaction）')
      }
      const result = await compaction.compactNow(targetAgent, exec?.signal)
      const row = helpers.ensureLedger(String(agent.id))
      if (helpers.pushEvent) {
        helpers.pushEvent(row, {
          kind: 'notice',
          from: 'lead',
          to: target,
          text: `压缩上下文：${target}`,
        })
      }
      return {
        ok: true,
        target,
        compacted: result !== null && result !== undefined,
      }
    },
  }
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {unknown} config
 */
export function apply(ctx, config) {
  const options = readOptions(config)
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  const ledgerFile = path.join(home, '.dsh-expert-team', 'ledger.json')
  const ledger = loadLedger(ledgerFile)
  const dispatcherStates = new Map()
  const scannedSessions = new Set()
  let ledgerSeq = Number(ledger.seq) || 0
  let saveTimer = null

  /** @param {string} message @param {...unknown} args */
  const log = (message, ...args) => {
    try {
      if (ctx.logger && typeof ctx.logger.warn === 'function') {
        ctx.logger.warn(`[dsh-expert-team] ${message}`, ...args)
      } else {
        console.warn(`[dsh-expert-team] ${message}`, ...args)
      }
    } catch {
      // Logging must never break a turn.
    }
  }

  function teamService() {
    try {
      return ctx.get('agentTeams')
    } catch {
      return undefined
    }
  }

  function agentsService() {
    try {
      return ctx.get('agents')
    } catch {
      return undefined
    }
  }

  function subagentsService() {
    try {
      return ctx.get('subagents')
    } catch {
      return undefined
    }
  }

  function compactionService() {
    try {
      return ctx.get('compaction')
    } catch {
      return undefined
    }
  }

  function llmService() {
    try {
      return ctx.get('llm')
    } catch {
      return undefined
    }
  }

  /**
   * Resolve a just-published child Agent, with a short bounded wait because the
   * Team spawn result may arrive a tick before the Agent registry entry.
   * @param {string} sessionId
   * @param {number} timeoutMs
   */
  async function waitForAgent(sessionId, timeoutMs) {
    if (!sessionId) return undefined
    const deadline = Date.now() + timeoutMs
    let child = agentsService()?.get(sessionId)
    while (!child && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50))
      child = agentsService()?.get(sessionId)
    }
    return child
  }

  /** @param {string} sessionId */
  function membershipOf(sessionId) {
    const agents = agentsService()
    const agent = agents?.get?.(sessionId)
    if (!agent) return undefined
    const teams = teamService()
    if (!teams?.membership) return undefined
    try {
      return teams.membership(agent)
    } catch {
      return undefined
    }
  }

  /** @param {{ id: string }} agent */
  function membersOf(agent) {
    const teams = teamService()
    if (!teams?.listMembers) return []
    try {
      return teams.listMembers(agent) || []
    } catch {
      return []
    }
  }

  /**
   * Only expert-team sessions keep a display ledger. Every root Agent is an
   * implicit Team Lead, so without this guard ordinary sessions and ordinary
   * subagents would slowly fill the ledger with unrelated messages.
   * @param {string} leadId
   * @param {{ ctx?: any } | undefined} rootAgent
   */
  function isTrackedTeam(leadId, rootAgent) {
    const row = ledger.teams[leadId]
    if (row?.mode === 'expert-team') return true
    try {
      return (
        ctx.get('agentPresets')?.composedPreset?.(rootAgent?.ctx) === 'expert-team'
      )
    } catch {
      return false
    }
  }

  /** @param {string} leadId */
  function ensureLedger(leadId) {    let row = ledger.teams[leadId]
    if (!row || typeof row !== 'object') {
      row = {
        mode: '',
        goal: '',
        messages: [],
        events: [],
        errors: [],
        closed: {},
        stopped: {},
        pending: {},
        models: {},
        notifiedTasks: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      ledger.teams[leadId] = row
    }
    if (!Array.isArray(row.messages)) row.messages = []
    if (!Array.isArray(row.events)) row.events = []
    if (!Array.isArray(row.errors)) row.errors = []
    if (!Array.isArray(row.notifiedTasks)) row.notifiedTasks = []
    if (!row.closed || typeof row.closed !== 'object') row.closed = {}
    if (!row.stopped || typeof row.stopped !== 'object') row.stopped = {}
    if (!row.pending || typeof row.pending !== 'object') row.pending = {}
    if (!row.models || typeof row.models !== 'object') row.models = {}
    return row
  }

  /**
   * Append one display event to the collaboration/event tree.
   * @param {object} row
   * @param {{ kind: string, from: string, to: string, text: string, at?: number, taskId?: string, status?: string }} event
   */
  function pushEvent(row, event) {
    row.events.push({
      seq: (ledgerSeq += 1),
      at: event.at || Date.now(),
      kind: event.kind,
      from: event.from,
      to: event.to,
      text: clip(event.text, 1200),
      ...(event.taskId ? { taskId: event.taskId } : {}),
      ...(event.status ? { status: event.status } : {}),
    })
    if (row.events.length > 400) {
      row.events.splice(0, row.events.length - 400)
    }
    row.updatedAt = Date.now()
    scheduleSave()
  }

  function scheduleSave() {
    if (saveTimer !== null) return
    saveTimer = setTimeout(() => {
      saveTimer = null
      saveNow()
    }, 800)
    try {
      saveTimer.unref?.()
    } catch {
      // Browserless runtimes may not implement unref.
    }
  }

  function saveNow() {
    try {
      ledger.seq = ledgerSeq
      const entries = Object.entries(ledger.teams)
      if (entries.length > 80) {
        entries
          .sort((a, b) => (Number(a[1]?.updatedAt) || 0) - (Number(b[1]?.updatedAt) || 0))
          .slice(0, entries.length - 80)
          .forEach(([key]) => {
            delete ledger.teams[key]
          })
      }
      writeLedger(ledgerFile, ledger)
    } catch (error) {
      log('could not persist the communication ledger: %o', error)
    }
  }

  /**
   * Detect an expert-team mode from the durable Session log. This is the
   * recovery path when the ledger file is lost; the Session log stays the
   * source of truth.
   * @param {{ id: string, session?: { events?: unknown } }} agent
   */
  function detectKickoffFromSession(agent) {
    const id = String(agent.id)
    if (scannedSessions.has(id)) return
    scannedSessions.add(id)
    const row = ensureLedger(id)
    if (row.mode === 'expert-team') return
    const events = agent.session?.events
    if (!Array.isArray(events)) return
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index]
      if (event?.type !== 'user/message') continue
      const kickoff = parseKickoff([event.data])
      if (!kickoff) continue
      row.mode = 'expert-team'
      if (kickoff.goal) row.goal = kickoff.goal
      row.updatedAt = Date.now()
      scheduleSave()
      return
    }
  }

  /**
   * When the user types the goal directly instead of using the goal card,
   * recover a display goal from the first human message in the Session log.
   * @param {{ session?: { events?: unknown } }} agent
   * @param {{ goal?: string }} row
   */
  function fillGoalFromSession(agent, row) {
    if (row.goal) return
    const events = agent.session?.events
    if (!Array.isArray(events)) return
    for (const event of events) {
      if (event?.type !== 'user/message') continue
      const source = event.data?.source
      if (!source || source.kind !== 'user') continue
      const kickoff = parseKickoff([event.data])
      if (kickoff) {
        row.goal = kickoff.goal
      } else {
        const text = textOf(event.data?.content).trim()
        if (!text) continue
        row.goal = clip(text, 4000)
      }
      row.updatedAt = Date.now()
      scheduleSave()
      return
    }
  }

  /**
   * @param {{ id: string, ctx?: any, session?: any }} agent
   * @param {Array<{ role: string }>} members
   */
  function isExpertMode(agent, members) {
    const leadId = String(agent.id)
    const row = ensureLedger(leadId)
    if (row.mode === 'expert-team') return true

    let preset = ''
    try {
      preset = ctx.get('agentPresets')?.composedPreset?.(agent.ctx) || ''
    } catch {
      preset = ''
    }
    if (!preset && agent.session) {
      try {
        preset = ctx.get('agentPresets')?.presetForSession?.(agent.session) || ''
      } catch {
        preset = ''
      }
    }
    if (preset === 'expert-team') {
      row.mode = 'expert-team'
      row.updatedAt = Date.now()
      fillGoalFromSession(agent, row)
      scheduleSave()
      return true
    }
    if (members.length > 1) {
      row.mode = 'expert-team'
      row.updatedAt = Date.now()
      fillGoalFromSession(agent, row)
      scheduleSave()
      return true
    }
    return false
  }

  /**
   * Record one accepted peer message. The target Session owns the durable
   * `user/message`; we only keep a bounded display copy for the collaboration
   * tree, while the Session log remains the source of truth.
   * @param {{ id?: string }} session
   * @param {{ type?: string, time?: number, data?: any }} event
   */
  function recordPeerMessage(session, event) {
    if (event?.type !== 'user/message') return
    const data = event.data
    const source = data?.source
    if (!source || source.kind !== 'agent-message' || !source.senderSessionId) return
    const senderId = String(source.senderSessionId)
    const targetId = String(session?.id ?? '')
    if (!senderId || !targetId) return
    const sender = membershipOf(senderId)
    const target = membershipOf(targetId)
    const leadId = target?.root?.id
      ? String(target.root.id)
      : sender?.root?.id
        ? String(sender.root.id)
        : ''
    const leadRoot = target?.root || sender?.root
    if (!leadId || !isTrackedTeam(leadId, leadRoot)) return
    const body = stripTeamPrefix(textOf(data.content))
    if (!body) return
    const row = ensureLedger(leadId)
    const at = Number(event.time) || Date.now()
    const from = sender?.name || senderId.slice(0, 8)
    const to = target?.name || targetId.slice(0, 8)
    const text = clip(body.replace(/\s+/gu, ' ').trim(), 1200)
    row.messages.push({
      seq: (ledgerSeq += 1),
      at,
      from,
      fromRole: sender?.role || 'teammate',
      to,
      toRole: target?.role || 'teammate',
      text,
    })
    if (row.messages.length > MAX_MESSAGES_PER_TEAM) {
      row.messages.splice(0, row.messages.length - MAX_MESSAGES_PER_TEAM)
    }
    pushEvent(row, { at, kind: 'message', from, to, text })

    // A lightweight request tracker: a message from A to B is a potential
    // request; a reply from B clears it, and a completed task by B notifies
    // A. The shared task board remains authoritative; this only decides who
    // should be woken with a completion notice.
    if (from !== to) {
      const pending = row.pending && typeof row.pending === 'object' ? row.pending : {}
      pending[`${from}->${to}`] = { from, to, at, text: clip(text, 300) }
      delete pending[`${to}->${from}`]
      const entries = Object.entries(pending)
      if (entries.length > 60) {
        entries
          .sort((a, b) => (Number(a[1]?.at) || 0) - (Number(b[1]?.at) || 0))
          .slice(0, entries.length - 60)
          .forEach(([key]) => {
            delete pending[key]
          })
      }
      row.pending = pending
    }
    // Delivery wakes the target, so a temporary-stop marker no longer holds.
    if (row.stopped?.[to]) delete row.stopped[to]
    row.updatedAt = Date.now()
    scheduleSave()
  }

  /**
   * Record a human message into the event tree. Human prompts are deliberately
   * visible: they are the highest-authority events in the workflow.
   * @param {{ id?: string }} session
   * @param {{ type?: string, time?: number, data?: any }} event
   */
  function recordUserMessage(session, event) {
    if (event?.type !== 'user/message') return
    const source = event.data?.source
    if (!source || source.kind !== 'user') return
    const target = membershipOf(String(session?.id ?? ''))
    if (!target?.root?.id) return
    const leadId = String(target.root.id)
    if (!isTrackedTeam(leadId, target.root)) return
    const kickoff = parseKickoff([event.data])
    const raw = kickoff
      ? `目标：${kickoff.goal}`
      : textOf(event.data?.content).replace(/\s+/gu, ' ').trim()
    if (!raw) return
    const row = ensureLedger(leadId)
    // The user outranks the dispatcher: a direct user message to a teammate
    // revives it even if the dispatcher had closed or temporarily stopped it.
    if (target.role === 'teammate') {
      if (row.closed?.[target.name]) {
        delete row.closed[target.name]
        pushEvent(row, {
          kind: 'user',
          from: 'user',
          to: target.name,
          text: `你恢复了对助手 ${target.name} 的会话`,
        })
      }
      if (row.stopped?.[target.name]) delete row.stopped[target.name]
    }
    pushEvent(row, {
      at: Number(event.time) || Date.now(),
      kind: 'user',
      from: 'user',
      to: target.name || 'lead',
      text: clip(raw, 900),
    })
  }

  /**
   * Notify the task's dependents, recent requesters, and the Lead when a task
   * completes. The owner is the sender when its Agent is live; otherwise the
   * Lead sends the notice.
   * @param {{ id: string, ctx?: any }} leadAgent
   * @param {{ id: string, revision?: number, subject?: string, ownerName?: string }} task
   */
  async function notifyTaskCompletion(leadAgent, task) {
    const teams = teamService()
    if (!teams?.sendMessage) return
    const leadId = String(leadAgent.id)
    const row = ensureLedger(leadId)
    const key = `${task.id}:${task.revision || 0}`
    if (row.notifiedTasks.includes(key)) return
    row.notifiedTasks.push(key)
    if (row.notifiedTasks.length > 200) {
      row.notifiedTasks.splice(0, row.notifiedTasks.length - 200)
    }

    const members = membersOf(leadAgent)
    const ownerName = task.ownerName || 'lead'
    const ownerMember = members.find(
      (member) => member.name === ownerName && member.role === 'teammate',
    )
    let ownerAgent = ownerMember ? agentsService()?.get(ownerMember.id) : leadAgent
    if (!ownerAgent?.ctx) ownerAgent = leadAgent
    const caller = ownerAgent
    const recipients = new Map()

    try {
      const tasks = teams.listTasks(leadAgent) || []
      for (const candidate of tasks) {
        if (!Array.isArray(candidate.blockedBy) || !candidate.blockedBy.includes(task.id)) {
          continue
        }
        if (candidate.status === 'completed' || candidate.status === 'deleted') continue
        const name = candidate.ownerName
        if (!name || name === ownerName || name === 'lead') continue
        recipients.set(
          name,
          `依赖它的任务 #${String(candidate.id).replace(/^task-/, '')} 已解除`,
        )
      }
    } catch (error) {
      log('could not inspect dependent tasks: %o', error)
    }

    const pending = row.pending && typeof row.pending === 'object' ? row.pending : {}
    for (const [pendingKey, request] of Object.entries(pending)) {
      if (!request || request.to !== ownerName || request.from === ownerName) continue
      if (request.from && request.from !== 'lead') {
        recipients.set(request.from, '你之前的请求已处理')
      }
      delete pending[pendingKey]
    }
    row.pending = pending

    const closed = row.closed && typeof row.closed === 'object' ? row.closed : {}
    const base = `[任务完成] #${String(task.id).replace(/^task-/, '')}「${task.subject || ''}」由 ${ownerName} 完成。`
    for (const [name, reason] of recipients) {
      if (name === ownerName || closed[name]) continue
      if (String(caller.id) === name) continue
      try {
        await teams.sendMessage(caller, {
          target: name,
          content: [{ type: 'text', text: `${base}${reason}，可以继续。` }],
          signal: AbortSignal.timeout(10000),
        })
      } catch (error) {
        log('could not notify %s about task %s: %o', name, task.id, error)
      }
    }

    if (ownerName !== 'lead' && String(caller.id) !== leadId) {
      try {
        await teams.sendMessage(caller, {
          target: 'lead',
          content: [{ type: 'text', text: `${base}相关助手已通知。` }],
          signal: AbortSignal.timeout(10000),
        })
      } catch (error) {
        log('could not notify the lead about task %s: %o', task.id, error)
      }
    }
    row.updatedAt = Date.now()
    scheduleSave()
  }

  /**
   * Record Team-domain events into the event tree, and fan out completion
   * notices. Task and member records live in the Lead Session log.
   * @param {{ id?: string }} session
   * @param {{ type?: string, time?: number, data?: any }} event
   */
  function recordTeamEvent(session, event) {
    if (event?.type !== 'team/task' && event?.type !== 'team/member') return
    const sessionId = String(session?.id ?? '')
    const target = membershipOf(sessionId)
    const leadId = target?.root?.id ? String(target.root.id) : sessionId
    if (!leadId) return
    const row = ensureLedger(leadId)
    const at = Number(event.time) || Date.now()

    if (event.type === 'team/task') {
      const task = event.data?.task
      if (!task?.id) return
      const number = String(task.id).replace(/^task-/, '')
      const owner = task.ownerName || 'lead'
      const status = task.status || 'pending'
      const statusLabel =
        status === 'completed'
          ? '已完成'
          : status === 'in_progress'
            ? '进行中'
            : status === 'deleted'
              ? '已删除'
              : '待开始'
      const text =
        task.revision === 1
          ? `创建任务 #${number}「${task.subject || ''}」${owner === 'lead' ? '' : ` → ${owner}`}`
          : `任务 #${number}「${task.subject || ''}」${statusLabel}${task.ownerName ? ` · @${task.ownerName}` : ''}`
      pushEvent(row, {
        at,
        kind: 'task',
        from: owner,
        to: owner,
        text,
        taskId: task.id,
        status,
      })
      if (status === 'completed') {
        const leadAgent = agentsService()?.get(leadId)
        if (leadAgent?.ctx) {
          void notifyTaskCompletion(leadAgent, task).catch((error) => {
            log('task completion notification failed: %o', error)
          })
        }
      }
      return
    }

    const member = event.data?.member
    if (!member?.name) return
    const phase = member.phase || 'provisioning'
    const text =
      phase === 'active'
        ? `助手 ${member.name} 就绪`
        : phase === 'failed'
          ? `助手 ${member.name} 创建失败${member.error ? `：${member.error}` : ''}`
          : `助手 ${member.name} 创建中`
    pushEvent(row, { at, kind: 'member', from: 'lead', to: member.name, text })
  }


  /**
   * Install or refresh the Lead-only dispatcher section, write guard, and the
   * close/compact tools. This runs even before the first teammate exists, so
   * the Lead can evaluate the goal and build the team itself.
   * @param {{ id: string, ctx: any, session?: any }} agent
   */
  function ensureDispatcher(agent) {
    if (!agent?.ctx) return
    const membership = membershipOf(agent.id)
    if (!membership || membership.role !== 'lead') return
    detectKickoffFromSession(agent)
    const members = membersOf(agent)
    if (!isExpertMode(agent, members)) return

    const leadId = String(agent.id)
    const row = ensureLedger(leadId)
    const closed = row.closed && typeof row.closed === 'object' ? row.closed : {}
    const activeTeammates = members.filter(
      (member) => member.role === 'teammate' && !closed[member.name],
    )
    const signature = JSON.stringify({
      mode: 'expert-team',
      goal: row.goal || '',
      members: activeTeammates.map((member) => [member.name, member.description || '']),
      closed: Object.keys(closed).sort(),
    })
    const current = dispatcherStates.get(leadId)
    if (current?.signature === signature) return
    if (current) {
      try {
        current.dispose()
      } catch {
        // The Agent context may already be unwinding.
      }
      dispatcherStates.delete(leadId)
    }

    const prompt = agent.ctx.systemPrompt
    if (!prompt?.section) return
    const tools = agent.ctx.tools
    const text = buildDispatcherPrompt(row.goal, members, closed)
    let dispose
    try {
      dispose = agent.ctx.effect(
        () => {
          const offSection = prompt.section({
            name: SECTION_NAME,
            order: SECTION_ORDER,
            interpolate: false,
            text,
          })

          let offGuard
          if (tools?.guard) {
            offGuard = tools.guard((execution) => {
              if (!execution || typeof execution.name !== 'string') return undefined
              if (execution.agent && String(execution.agent.id) !== leadId) return undefined
              const args = toolArguments(execution)
              if (MUTATING_TOOLS.has(execution.name)) {
                return '调度师不直接修改文件或执行写命令；请把这项工作派给对应的专家助手。'
              }
              if (execution.name === 'send_message') {
                const target = typeof args.target === 'string' ? args.target.trim() : ''
                if (target && row.closed?.[target]) {
                  return `助手 ${target} 已关闭；不要给它发消息，需要该领域时请创建新助手。`
                }
              }
              if (execution.name === 'team_task_update' && args.action === 'reassign') {
                const owner = typeof args.owner === 'string' ? args.owner.trim() : ''
                if (owner && row.closed?.[owner]) {
                  return `助手 ${owner} 已关闭；请把任务改派给在役助手。`
                }
              }
              return undefined
            })
          }

          let offClose
          let offCompact
          let offModels
          let offOpen
          if (tools?.register) {
            const helpers = {
              teamService,
              membersOf,
              ensureLedger,
              pushEvent,
              scheduleSave,
              ensureDispatcher,
              getSubagents: subagentsService,
              getAgents: agentsService,
              getCompaction: compactionService,
              getLlm: llmService,
              getFreshProvider: () => options.freshProvider,
              waitForAgent,
              log,
            }
            try {
              offClose = tools.register(closeToolDefinition(agent, helpers))
            } catch (error) {
              log('could not register expert_team_close: %o', error)
            }
            try {
              offCompact = tools.register(compactToolDefinition(agent, helpers))
            } catch (error) {
              log('could not register expert_team_compact: %o', error)
            }
            try {
              offModels = tools.register(modelsToolDefinition(agent, helpers))
            } catch (error) {
              log('could not register expert_team_models: %o', error)
            }
            try {
              offOpen = tools.register(openToolDefinition(agent, helpers))
            } catch (error) {
              log('could not register expert_team_open: %o', error)
            }
          }

          return () => {
            try {
              offClose?.()
            } catch {
              // Already gone.
            }
            try {
              offCompact?.()
            } catch {
              // Already gone.
            }
            try {
              offModels?.()
            } catch {
              // Already gone.
            }
            try {
              offOpen?.()
            } catch {
              // Already gone.
            }
            try {
              offGuard?.()
            } catch {
              // Already gone.
            }
            try {
              offSection()
            } catch {
              // Already gone.
            }
          }
        },
        'dsh-expert-team.dispatcher()',
      )
    } catch (error) {
      log('could not install the dispatcher capabilities: %o', error)
      return
    }
    dispatcherStates.set(leadId, { signature, dispose })
  }

  // ---------------------------------------------------------------------
  // Session events: peer messages, human interventions, task/member events.
  // ---------------------------------------------------------------------
  ctx.on('session/event', (session, event) => {
    try {
      recordPeerMessage(session, event)
      recordUserMessage(session, event)
      recordTeamEvent(session, event)
    } catch (error) {
      log('could not record a team event: %o', error)
    }
  })

  // `interrupt_agent` means "temporarily stopped", not "closed". Record it so
  // the tree can paint the assistant red; the next delivery or run clears it.
  ctx.on('tools/result', (execution, result) => {
    try {
      if (execution?.name !== 'interrupt_agent' || result?.isError === true) return
      const leadId = String(execution.agent?.id || '')
      if (!leadId) return
      const membership = membershipOf(leadId)
      if (!membership || membership.role !== 'lead') return
      const args = toolArguments(execution)
      const target = typeof args.target === 'string' ? args.target.trim() : ''
      if (!target) return
      const row = ensureLedger(leadId)
      row.stopped[target] = { at: Date.now(), reason: 'interrupt' }
      row.updatedAt = Date.now()
      pushEvent(row, {
        kind: 'notice',
        from: 'lead',
        to: target,
        text: `暂时停止助手 ${target}`,
        status: 'stopped',
      })
      scheduleSave()
    } catch (error) {
      log('could not record an interrupt: %o', error)
    }
  })

  // A teammate that starts running is no longer temporarily stopped.
  ctx.on('agent/status', ({ agent, status }) => {
    try {
      if (status !== 'running') return
      const membership = membershipOf(agent?.id)
      if (!membership || membership.role !== 'teammate') return
      const leadId = String(membership.root.id)
      const row = ensureLedger(leadId)
      if (!row.stopped?.[membership.name]) return
      delete row.stopped[membership.name]
      row.updatedAt = Date.now()
      scheduleSave()
    } catch (error) {
      log('could not clear a stop marker: %o', error)
    }
  })

  // ---------------------------------------------------------------------
  // Agent lifecycle: resume an existing expert team, and clean up.
  // ---------------------------------------------------------------------
  ctx.on('agent/created', ({ agent }) => {
    queueMicrotask(() => {
      try {
        ensureDispatcher(agent)
      } catch (error) {
        log('could not restore the dispatcher on agent creation: %o', error)
      }
    })
  })

  ctx.on('agent/disposed', ({ agent }) => {
    const state = dispatcherStates.get(String(agent?.id))
    if (!state) return
    try {
      state.dispose()
    } catch {
      // The Agent context may already be unwinding.
    }
    dispatcherStates.delete(String(agent?.id))
  })

  // ---------------------------------------------------------------------
  // The goal-only kickoff gate: mark the mode before the Lead's first step.
  // The Lead itself evaluates the goal and spawns the team through the shipped
  // Team tools; this plugin does not pre-create assistants.
  // ---------------------------------------------------------------------
  ctx.on('agent/pre-step', async (payload, next) => {
    try {
      const kickoff = parseKickoff(payload?.messages)
      if (kickoff) {
        const row = ensureLedger(String(payload.agent.id))
        row.mode = 'expert-team'
        row.goal = clip(kickoff.goal, 4000)
        row.updatedAt = Date.now()
        scheduleSave()
      }
      ensureDispatcher(payload?.agent)
    } catch (error) {
      log('expert-team kickoff failed: %o', error)
    }
    return next()
  })

  // ---------------------------------------------------------------------
  // Read-only route for the collaboration tree.
  // ---------------------------------------------------------------------
  try {
    ctx.inject(['webServer'], (webCtx) => {
      webCtx.effect(
        () =>
          webCtx.webServer.register({
            kind: 'exact',
            path: '/dsh-expert-team/ledger',
            handler: (req, res) => {
              if (req.method !== 'GET' && req.method !== 'HEAD') {
                res.writeHead(405, { Allow: 'GET, HEAD' })
                res.end()
                return
              }
              let sessionId = ''
              try {
                sessionId = new URL(req.url || '/', 'http://localhost').searchParams.get('sessionId') || ''
              } catch {
                sessionId = ''
              }
              if (!/^[A-Za-z0-9_-]{1,120}$/u.test(sessionId)) {
                sendJson(res, 400, { ok: false, error: 'invalid sessionId' })
                return
              }
              const row = ledger.teams[sessionId]
              sendJson(res, 200, {
                ok: true,
                mode: row?.mode || '',
                goal: row?.goal || '',
                messages: Array.isArray(row?.messages) ? row.messages.slice(-120) : [],
                events: Array.isArray(row?.events) ? row.events.slice(-200) : [],
                errors: Array.isArray(row?.errors) ? row.errors : [],
                closed: row?.closed && typeof row.closed === 'object' ? row.closed : {},
                stopped: row?.stopped && typeof row.stopped === 'object' ? row.stopped : {},
                pending: row?.pending && typeof row.pending === 'object' ? row.pending : {},
                models: row?.models && typeof row.models === 'object' ? row.models : {},
                createdAt: row?.createdAt || null,
                updatedAt: row?.updatedAt || null,
              })
            },
          }),
        'dsh-expert-team: ledger route',
      )
    })
  } catch (error) {
    log('could not register the ledger route: %o', error)
  }

  // Local development: after a Host reload, ask the client module graph to
  // publish the installed bundle again so a page refresh receives the current
  // client.js without waiting for a full application restart.
  try {
    ctx.inject(['clientModules'], (modulesCtx) => {
      const timer = setTimeout(() => {
        try {
          modulesCtx.clientModules?.rebuilt?.('dsh-expert-team')
        } catch {
          // The client graph may not be serving this profile.
        }
      }, 1500)
      try {
        timer.unref?.()
      } catch {
        // Browserless runtimes may not implement unref.
      }
      modulesCtx.effect(
        () => () => clearTimeout(timer),
        'dsh-expert-team: client bundle refresh',
      )
    })
  } catch {
    // No client module graph in this runtime.
  }

  // Flush the ledger on unload and release every per-Agent registration.
  ctx.effect(
    () => () => {
      for (const state of dispatcherStates.values()) {
        try {
          state.dispose()
        } catch {
          // Already gone.
        }
      }
      dispatcherStates.clear()
      if (saveTimer !== null) {
        clearTimeout(saveTimer)
        saveTimer = null
      }
      saveNow()
    },
    'dsh-expert-team: flush ledger',
  )

  log('ready (provider=%s)', options.freshProvider)
}
