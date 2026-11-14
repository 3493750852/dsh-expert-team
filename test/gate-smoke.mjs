/**
 * Team-gate smoke test for dsh-expert-team.
 *
 * The shipped Agent Teams tools are installed in every root Agent scope, so an
 * ordinary conversation's assistant could assemble a team by itself. Covers:
 *   - an ordinary session gets the team gate and is denied team creation;
 *   - non-team tools and subagent messaging stay available;
 *   - the user's kickoff message lifts the gate and installs the dispatcher;
 *   - an expert-team preset session and a teammate never get the gate.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-expert-team-gate-'))
process.env.DSH_HOME = home

const plugin = await import('../index.js')

const events = new Map()
const tools = new Map()
const sections = []
const guards = []

function addSection(section) {
  sections.push(section)
  let live = true
  return () => {
    if (!live) return
    live = false
    const index = sections.indexOf(section)
    if (index >= 0) sections.splice(index, 1)
  }
}

function addGuard(guard) {
  guards.push(guard)
  let live = true
  return () => {
    if (!live) return
    live = false
    const index = guards.indexOf(guard)
    if (index >= 0) guards.splice(index, 1)
  }
}

const presetsByCtx = new Map()
const liveAgents = new Map()
const teammateLead = new Map()

function makeAgent(id, preset = '') {
  const agent = {
    id,
    session: { events: [] },
    ctx: {
      systemPrompt: { section: addSection },
      tools: {
        guard: addGuard,
        register(definition) {
          tools.set(definition.name, definition)
          let live = true
          return () => {
            if (!live) return
            live = false
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
  presetsByCtx.set(agent.ctx, preset)
  liveAgents.set(id, agent)
  return agent
}

const team = {
  membership(agent) {
    const leadId = teammateLead.get(agent.id)
    if (leadId) {
      return { root: liveAgents.get(leadId), id: `team-${leadId}`, role: 'teammate', name: agent.id }
    }
    return { root: agent, id: `team-${agent.id}`, role: 'lead', name: 'lead' }
  },
  listMembers(agent) {
    return [
      {
        id: agent.id,
        name: 'lead',
        role: 'lead',
        phase: 'active',
        description: 'dispatcher',
      },
    ]
  },
  async spawnTeammate() {
    throw new Error('the gate smoke test never spawns')
  },
  async sendMessage() {
    return { messageId: 'm' }
  },
  interrupt() {
    return { previousStatus: 'inactive' }
  },
  listTasks() {
    return []
  },
  async updateTask() {},
}

const ctx = {
  logger: { warn: (...args) => console.log('[warn]', ...args) },
  get(name) {
    if (name === 'agents') return { get: (id) => liveAgents.get(id) }
    if (name === 'agentTeams') return team
    if (name === 'agentPresets') {
      return {
        composedPreset: (context) => presetsByCtx.get(context) || '',
        presetForSession: () => null,
      }
    }
    if (name === 'subagents') return { async drainChildren() {} }
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
const created = events.get('agent/created')
const step = (agent, text) =>
  preStep(
    {
      agent,
      messages: [{ role: 'user', content: [{ type: 'text', text }] }],
      turn: 1,
      step: 1,
      signal: new AbortController().signal,
    },
    async () => ({ kind: 'enter', messages: [] }),
  )

const gateSections = () => sections.filter((section) => section.name === 'expert-team/gate')
const dispatcherSections = () =>
  sections.filter((section) => section.name === 'expert-team/dispatcher')
const gateDenial = (agent, name, args) => {
  for (const guard of guards) {
    const reason = guard({ name, agent, arguments: args })
    if (reason) return reason
  }
  return undefined
}

// 1. An ordinary conversation is gated on its first step.
const normal = makeAgent('lead-normal', 'standard')
await step(normal, '帮我看一下这个会话为什么会自己开团队。')

assert.equal(gateSections().length, 1, 'ordinary session installs the team gate section')
assert.match(gateSections()[0].text, /普通对话/)
assert.match(gateSections()[0].text, /拉起专家团队/)
assert.match(gateSections()[0].text, /spawn_teammate/)
assert.equal(gateSections()[0].order, 700, 'the gate rule comes after the shipped team policy')
assert.equal(dispatcherSections().length, 0, 'ordinary session has no dispatcher prompt')
assert.equal(tools.size, 0, 'ordinary session gets no Lead-only expert tools')

assert.match(gateDenial(normal, 'spawn_teammate', { name: 'dev' }), /不能自行组建团队/)
assert.match(gateDenial(normal, 'expert_team_open', { name: 'dev' }), /不能自行组建团队/)
assert.match(gateDenial(normal, 'team_task_create', { subject: 'x' }), /不能自行组建团队/)
assert.match(gateDenial(normal, 'team_task_update', { task_id: 'task-1' }), /不能自行组建团队/)
assert.match(
  gateDenial(normal, 'send_message', { target: 'dev', message: 'hi' }),
  /不能自行组建团队/,
)
assert.match(gateDenial(normal, 'interrupt_agent', { target: 'dev' }), /不能自行组建团队/)

// Non-team work stays available: writing, reading, and subagent delegation.
assert.equal(gateDenial(normal, 'write', { path: 'a.txt' }), undefined)
assert.equal(gateDenial(normal, 'read', { path: 'a.txt' }), undefined)
assert.equal(gateDenial(normal, 'subagent', { description: 'x', prompt: 'y' }), undefined)
assert.equal(
  gateDenial(normal, 'send_message', { agent_id: 'child-1', message: 'continue' }),
  undefined,
  'the subagent send_message form (agent_id) is not a team action',
)

// Another ordinary session gets its own gate, not a shared one.
const other = makeAgent('lead-other', 'standard')
await step(other, '第二个普通会话')
assert.equal(gateSections().length, 2, 'each ordinary session gets its own gate section')
assert.equal(gateDenial(other, 'spawn_teammate', { name: 'dev' })?.includes('不能自行组建团队'), true)

// 2. The user's explicit kickoff lifts the gate and installs the dispatcher.
await step(
  normal,
  [
    '专家团队初始化',
    '目标：',
    '做一个待办应用。',
    '请调度师先评估目标，决定需要哪些专家，自行创建助手并组建团队，然后建任务、按顺序派发。',
  ].join('\n'),
)
assert.equal(gateSections().length, 1, 'the kickoff session is no longer gated')
assert.equal(dispatcherSections().length, 1, 'the dispatcher prompt is installed after the kickoff')
assert.equal(tools.has('expert_team_open'), true)
assert.equal(
  gateDenial(normal, 'spawn_teammate', { name: 'dev' }),
  undefined,
  'the expert session may create teammates',
)
assert.equal(gateDenial(normal, 'write', { path: 'a.txt' })?.includes('派给对应的专家助手'), true)

// 3. The expert-team preset is allowed from creation.
const presetAgent = makeAgent('lead-preset', 'expert-team')
await step(presetAgent, '做一个待办应用')
assert.equal(gateSections().length, 1, 'the preset session never gets a gate')
assert.equal(dispatcherSections().length, 2, 'the preset session installs the dispatcher')
assert.equal(gateDenial(presetAgent, 'spawn_teammate', { name: 'dev' }), undefined)

// 4. A teammate is not a Team Lead and is never gated.
const teammate = makeAgent('member-dev', '')
teammateLead.set('member-dev', 'lead-preset')
const before = sections.length
await step(teammate, '继续任务')
assert.equal(sections.length, before, 'a teammate installs neither gate nor dispatcher')
assert.equal(gateDenial(teammate, 'spawn_teammate', { name: 'dev' }), undefined)

// 5. agent/created installs the gate for a session that has not stepped yet.
const createdAgent = makeAgent('lead-created', 'standard')
const gateCountBeforeCreated = gateSections().length
created({ agent: createdAgent })
await new Promise((resolve) => setTimeout(resolve, 0))
assert.equal(
  gateSections().length,
  gateCountBeforeCreated + 1,
  'agent/created installs the gate before the first step',
)
assert.equal(gateDenial(createdAgent, 'spawn_teammate', { name: 'dev' })?.includes('不能自行组建团队'), true)

fs.rmSync(home, { recursive: true, force: true })
console.log('gate smoke test: ok')
