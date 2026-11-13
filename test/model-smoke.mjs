/**
 * Model-selection smoke test for dsh-expert-team.
 *
 * Covers the Lead-only model catalog, expert_team_open with a chosen model,
 * default-model fallback, and the "no LLM service" degradation path.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-expert-team-models-'))
process.env.DSH_HOME = home

const plugin = await import('../index.js')

const events = new Map()
const tools = new Map()
const selectedModels = []
const preflights = []
const spawns = []
let llmAvailable = true
let members = [
  { id: 'lead-1', name: 'lead', role: 'lead', phase: 'active', description: 'dispatcher' },
]

const llm = {
  listProviders: () => [{ id: 'deepseek', name: 'DeepSeek' }],
  listModels: async () => [
    { id: 'deepseek-v4-flash', name: 'Flash', description: 'fast default' },
    { id: 'deepseek-v4-pro', name: 'Pro', description: 'stronger reasoning' },
  ],
  async resolveCallConfig(selection) {
    preflights.push(selection)
    if (selection.model === 'missing-model') throw new Error('unknown model')
  },
}

const team = {
  membership(agent) {
    return {
      root: { id: 'lead-1' },
      id: 'team-1',
      role: agent.id === 'lead-1' ? 'lead' : 'teammate',
      name: agent.id === 'lead-1' ? 'lead' : agent.id.replace(/^member-/, ''),
    }
  },
  listMembers() {
    return members
  },
  async spawnTeammate(_caller, request) {
    spawns.push(request)
    const member = {
      id: `member-${request.name}`,
      name: request.name,
      role: 'teammate',
      phase: 'active',
      description: request.description,
    }
    members = members.concat(member)
    return { member }
  },
  interrupt() {
    return { previousStatus: 'inactive' }
  },
  listTasks() {
    return []
  },
  async updateTask() {},
  async sendMessage() {
    return { messageId: 'm' }
  },
}

const childAgents = new Map()
function childAgent(id) {
  if (!childAgents.has(id)) {
    childAgents.set(id, {
      id,
      ctx: {},
      model: {
        async select(selection) {
          selectedModels.push({ id, ...selection })
        },
      },
    })
  }
  return childAgents.get(id)
}

const leadAgent = {
  id: 'lead-1',
  session: { events: [] },
  ctx: {
    systemPrompt: {
      section() {
        return () => {}
      },
    },
    tools: {
      guard() {
        return () => {}
      },
      register(definition) {
        tools.set(definition.name, definition)
        return () => {
          if (tools.get(definition.name) === definition) tools.delete(definition.name)
        }
      },
    },
    get(name) {
      return name === 'compaction' ? { async compactNow() { return {} } } : undefined
    },
    effect(fn) {
      return fn()
    },
  },
}

const ctx = {
  logger: { warn: (...args) => console.log('[warn]', ...args) },
  get(name) {
    if (name === 'agents') {
      return {
        get(id) {
          return id === 'lead-1' ? leadAgent : id.startsWith('member-') ? childAgent(id) : undefined
        },
      }
    }
    if (name === 'agentTeams') return team
    if (name === 'agentPresets') return { composedPreset: () => '' }
    if (name === 'subagents') return { async drainChildren() {} }
    if (name === 'llm') return llmAvailable ? llm : undefined
    return undefined
  },
  on(name, handler) {
    events.set(name, handler)
  },
  effect(fn) {
    return fn()
  },
  inject() {},
}

plugin.apply(ctx, { freshProvider: 'spawn' })

const preStep = events.get('agent/pre-step')
await preStep(
  {
    agent: leadAgent,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              '专家团队初始化',
              '目标：',
              '做一个塔防游戏。',
              '请调度师先评估目标，决定需要哪些专家，自行创建助手并组建团队，然后建任务、按顺序派发。',
            ].join('\n'),
          },
        ],
      },
    ],
    turn: 1,
    step: 1,
    signal: new AbortController().signal,
  },
  async () => ({ kind: 'enter', messages: [] }),
)

assert.ok(tools.has('expert_team_models'), 'model catalog tool registered')
assert.ok(tools.has('expert_team_open'), 'model-aware open tool registered')

const catalogTool = tools.get('expert_team_models')
const openTool = tools.get('expert_team_open')

const catalog = await catalogTool.execute({}, { signal: new AbortController().signal })
assert.match(catalog, /deepseek — DeepSeek/)
assert.match(catalog, /deepseek\/deepseek-v4-flash/)
assert.match(catalog, /deepseek\/deepseek-v4-pro/)

const filtered = await catalogTool.execute(
  { provider: 'deepseek' },
  { signal: new AbortController().signal },
)
assert.match(filtered, /deepseek\/deepseek-v4-pro/)

const opened = await openTool.execute(
  {
    name: 'code',
    description: '代码逻辑',
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
    reasoning_effort: 'high',
  },
  { signal: new AbortController().signal },
)
assert.equal(opened.ok, true)
assert.equal(opened.modelSelected, true)
assert.equal(opened.id, 'member-code')
assert.deepEqual(preflights[0], {
  provider: 'deepseek',
  model: 'deepseek-v4-flash',
  reasoningEffort: 'high',
})
assert.equal(spawns.length, 1)
assert.equal(spawns[0].name, 'code')
assert.equal(spawns[0].context, 'fresh')
assert.equal(spawns[0].provider, 'spawn')
assert.match(spawns[0].prompt[0].text, /已就位/)
assert.deepEqual(selectedModels[0], {
  id: 'member-code',
  provider: 'deepseek',
  model: 'deepseek-v4-flash',
  reasoningEffort: 'high',
})

const openedDefault = await openTool.execute(
  { name: 'art', description: '美术资源' },
  { signal: new AbortController().signal },
)
assert.equal(openedDefault.modelSelected, false)
assert.equal(spawns.length, 2)
assert.equal(selectedModels.length, 1)

// The ledger carries the selected model for the event tree.
await new Promise((resolve) => setTimeout(resolve, 900))
const ledgerPath = path.join(home, '.dsh-expert-team', 'ledger.json')
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
assert.equal(ledger.teams['lead-1'].models.code.provider, 'deepseek')
assert.equal(ledger.teams['lead-1'].models.code.model, 'deepseek-v4-flash')
assert.equal(ledger.teams['lead-1'].models.code.selected, true)

// No LLM service: catalog degrades, selecting a model fails before spawn.
llmAvailable = false
const noLlm = await catalogTool.execute({}, { signal: new AbortController().signal })
assert.match(noLlm, /no LLM service/)
const before = spawns.length
await assert.rejects(
  openTool.execute(
    { name: 'bad', description: 'bad', provider: 'deepseek', model: 'deepseek-v4-pro' },
    { signal: new AbortController().signal },
  ),
  /LLM 服务不可用/,
)
assert.equal(spawns.length, before, 'model preflight failure creates no teammate')

// A bad model also fails before spawn.
llmAvailable = true
await assert.rejects(
  openTool.execute(
    { name: 'bad2', description: 'bad', provider: 'deepseek', model: 'missing-model' },
    { signal: new AbortController().signal },
  ),
  /unknown model/,
)
assert.equal(spawns.length, before, 'bad model creates no teammate')

fs.rmSync(home, { recursive: true, force: true })
console.log('model smoke test: ok')
