/**
 * Host-side smoke test for dsh-expert-team.
 *
 * It stubs only the Cordis seams the plugin touches, then exercises the real
 * goal-only kickoff gate, the Lead-only close/compact tools, the write guard,
 * and the peer-message ledger.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-expert-team-test-'))
process.env.DSH_HOME = home

const plugin = await import('../index.js')

const events = new Map()
const sections = []
const guards = []
const tools = new Map()
const interruptCalls = []
const drained = []
const released = []
const compactCalls = []
let presetId = ''

let members = [
  { id: 'lead-1', name: 'lead', role: 'lead', phase: 'active', description: 'dispatcher' },
]
let teamTasks = []

const team = {
  membership(agent) {
    return {
      root: { id: 'lead-1' },
      id: 'team-1',
      role: agent.id === 'lead-1' ? 'lead' : 'teammate',
      name: agent.id === 'lead-1' ? 'lead' : agent.id,
    }
  },
  listMembers() {
    return members
  },
  interrupt(_caller, target) {
    interruptCalls.push(target)
    return { previousStatus: 'inactive' }
  },
  listTasks() {
    return teamTasks
  },
  async updateTask(_caller, request) {
    const task = teamTasks.find((candidate) => candidate.id === request.taskId)
    if (!task) throw new Error('no task')
    if (request.action === 'release') {
      released.push(request.taskId)
      task.ownerName = undefined
      task.status = 'pending'
      task.revision += 1
    }
    return task
  },
  async spawnTeammate() {
    throw new Error('the host plugin must not spawn teammates itself')
  },
}

const compaction = {
  async compactNow() {
    compactCalls.push('lead')
    return { compacted: true }
  },
}

const agent = {
  id: 'lead-1',
  session: { events: [] },
  ctx: {
    systemPrompt: {
      section(section) {
        sections.push(section)
        return () => {}
      },
    },
    tools: {
      guard(guard) {
        guards.push(guard)
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
      return name === 'compaction' ? compaction : undefined
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
          return id === 'lead-1' ? agent : { id }
        },
      }
    }
    if (name === 'agentTeams') return team
    if (name === 'agentPresets') return { composedPreset: () => presetId }
    if (name === 'subagents') {
      return {
        async drainChildren(_parent, ids) {
          drained.push(...ids)
        },
      }
    }
    if (name === 'systemPrompt') return agent.ctx.systemPrompt
    if (name === 'tools') return agent.ctx.tools
    return undefined
  },
  on(name, handler) {
    events.set(name, handler)
  },
  effect(fn) {
    return fn()
  },
  inject(_deps, callback) {
    // No web server in this unit test.
    void callback
  },
}

plugin.apply(ctx, { freshProvider: 'spawn' })

assert.ok(events.has('agent/pre-step'), 'pre-step listener registered')
assert.ok(events.has('session/event'), 'session/event listener registered')

const kickoffText = [
  '专家团队初始化',
  '目标：',
  '做一个可联机的塔防小游戏，',
  '包含服务端、客户端与美术资源。',
  '请调度师先评估目标，决定需要哪些专家，自行创建助手并组建团队，然后建任务、按顺序派发。',
].join('\n')

const preStep = events.get('agent/pre-step')
let nextCalled = false
const decision = await preStep(
  {
    agent,
    messages: [{ role: 'user', content: [{ type: 'text', text: kickoffText }] }],
    turn: 1,
    step: 1,
    signal: new AbortController().signal,
  },
  async () => {
    nextCalled = true
    return { kind: 'enter', messages: [] }
  },
)
assert.equal(nextCalled, true, 'the step continues after kickoff')
assert.deepEqual(decision, { kind: 'enter', messages: [] })

assert.equal(sections.length, 1, 'the dispatcher section is installed before the first step')
assert.equal(sections[0].name, 'expert-team/dispatcher')
assert.match(sections[0].text, /用户只提供目标/)
assert.match(sections[0].text, /spawn_teammate/)
assert.match(sections[0].text, /expert_team_close/)
assert.match(sections[0].text, /expert_team_compact/)
assert.match(sections[0].text, /暂无在役助手/)

assert.equal(guards.length, 1, 'the write guard is installed')
assert.match(guards[0]({ name: 'write', agent }), /派给对应的专家助手/)
assert.match(guards[0]({ name: 'pwsh', agent }), /派给对应的专家助手/)
assert.equal(guards[0]({ name: 'read', agent }), undefined)
assert.equal(tools.has('expert_team_close'), true)
assert.equal(tools.has('expert_team_compact'), true)

// Simulate the Lead creating one teammate and one assigned task through the
// shipped Team tools; the next step refreshes the dispatcher prompt.
members = members.concat({
  id: 'member-code',
  name: 'code',
  role: 'teammate',
  phase: 'active',
  description: '代码逻辑 · 业务逻辑与代码实现',
})
teamTasks = [
  {
    id: 'task-1',
    revision: 1,
    subject: '实现核心循环',
    status: 'in_progress',
    ownerName: 'code',
    blockedBy: [],
    writeScopes: ['src/core'],
    ready: true,
    writeScopeWarnings: [],
  },
]
await preStep(
  {
    agent,
    messages: [{ role: 'user', content: [{ type: 'text', text: '继续' }] }],
    turn: 2,
    step: 1,
    signal: new AbortController().signal,
  },
  async () => ({ kind: 'enter', messages: [] }),
)
const latestSection = sections[sections.length - 1]
assert.match(latestSection.text, /code：代码逻辑/)
assert.equal(tools.has('expert_team_close'), true)
assert.equal(tools.has('expert_team_compact'), true)

const close = tools.get('expert_team_close')
const closeResult = await close.execute({ target: 'code', reason: '阶段完成' }, {})
assert.equal(closeResult.ok, true)
assert.equal(closeResult.alreadyClosed, false)
assert.deepEqual(interruptCalls, ['code'])
assert.deepEqual(drained, ['member-code'])
assert.deepEqual(released, ['task-1'])
assert.equal(closeResult.releasedTasks.includes('task-1'), true)
assert.equal(teamTasks[0].ownerName, undefined)

const closedGuard = guards[guards.length - 1]
assert.match(
  closedGuard({ name: 'send_message', agent, arguments: { target: 'code' } }),
  /已关闭/,
)
assert.match(
  closedGuard({
    name: 'team_task_update',
    agent,
    arguments: { action: 'reassign', owner: 'code' },
  }),
  /已关闭/,
)

const compact = tools.get('expert_team_compact')
const compactResult = await compact.execute({ target: 'lead' }, { signal: new AbortController().signal })
assert.deepEqual(compactResult, { ok: true, target: 'lead', compacted: true })
assert.equal(compactCalls.length, 1)

// A second close is idempotent.
const closeAgain = await close.execute({ target: 'code' }, {})
assert.equal(closeAgain.alreadyClosed, true)
assert.equal(interruptCalls.length, 1)

// Peer messages land in the bounded ledger used by the browser tree.
const sessionEvent = events.get('session/event')
sessionEvent(
  { id: 'member-code' },
  {
    type: 'user/message',
    time: Date.now(),
    data: {
      source: { kind: 'agent-message', form: 'relay', senderSessionId: 'lead-1' },
      content: [{ type: 'text', text: 'Team message from lead: 先实现核心循环。' }],
    },
  },
)

// The save is debounced; wait past the debounce.
await new Promise((resolve) => setTimeout(resolve, 900))
const ledgerPath = path.join(home, '.dsh-expert-team', 'ledger.json')
assert.ok(fs.existsSync(ledgerPath), 'ledger file persisted')
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
const row = ledger.teams['lead-1']
assert.ok(row, 'lead ledger exists')
assert.equal(row.mode, 'expert-team')
assert.equal(row.goal.includes('塔防'), true)
assert.ok(row.closed.code, 'closed teammate is recorded')
assert.equal(row.closed.code.reason, '阶段完成')
assert.equal(row.messages.length, 1)
assert.equal(row.messages[0].from, 'lead')
assert.equal(row.messages[0].to, 'member-code')
assert.match(row.messages[0].text, /先实现核心循环/)

// Preset detection installs the dispatcher before any kickoff message.
presetId = 'expert-team'
const agent2 = {
  id: 'lead-2',
  session: { events: [] },
  ctx: {
    systemPrompt: {
      section(section) {
        sections.push(section)
        return () => {}
      },
    },
    tools: agent.ctx.tools,
    get(name) {
      return name === 'compaction' ? compaction : undefined
    },
    effect(fn) {
      return fn()
    },
  },
}
const lead2Membership = () => ({
  root: { id: 'lead-2' },
  id: 'team-2',
  role: 'lead',
  name: 'lead',
})
const originalMembership = team.membership
team.membership = (candidate) =>
  candidate.id === 'lead-2' ? lead2Membership() : originalMembership(candidate)
const originalAgentsGet = ctx.get('agents').get
ctx.get = ((originalGet) => (name) => {
  if (name === 'agents') {
    return {
      get(id) {
        return id === 'lead-2' ? agent2 : originalAgentsGet(id)
      },
    }
  }
  return originalGet(name)
})(ctx.get)
const beforePreset = sections.length
await preStep(
  {
    agent: agent2,
    messages: [{ role: 'user', content: [{ type: 'text', text: '做一个待办应用' }] }],
    turn: 1,
    step: 1,
    signal: new AbortController().signal,
  },
  async () => ({ kind: 'enter', messages: [] }),
)
assert.ok(sections.length > beforePreset, 'expert preset installs the dispatcher with no kickoff text')
assert.match(sections[sections.length - 1].text, /做一个待办应用|等待用户给出目标/)

fs.rmSync(home, { recursive: true, force: true })
console.log('host smoke test: ok')
