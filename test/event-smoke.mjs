/**
 * Event-notification smoke test for dsh-expert-team.
 *
 * Covers the user-facing event tree concepts:
 *   - a teammate's completed task notifies the requester and the Lead;
 *   - interrupt_agent marks a temporary stop, and a later delivery clears it;
 *   - a direct user message revives an assistant the dispatcher had deprecated.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-expert-team-events-'))
process.env.DSH_HOME = home

const plugin = await import('../index.js')

const events = new Map()
const tools = new Map()
const sections = []
const guards = []
const sentMessages = []
let members = [
  { id: 'lead-1', name: 'lead', role: 'lead', phase: 'active', description: 'dispatcher' },
  { id: 'member-code', name: 'code', role: 'teammate', phase: 'active', description: '代码逻辑' },
  { id: 'member-art', name: 'art', role: 'teammate', phase: 'active', description: '美术资源' },
]
const teamTasks = [
  {
    id: 'task-1',
    revision: 1,
    subject: '实现核心循环',
    status: 'in_progress',
    ownerName: 'code',
    blockedBy: [],
    ready: true,
    writeScopes: [],
    writeScopeWarnings: [],
  },
  {
    id: 'task-2',
    revision: 1,
    subject: '图标资源',
    status: 'in_progress',
    ownerName: 'art',
    blockedBy: [],
    ready: true,
    writeScopes: [],
    writeScopeWarnings: [],
  },
]

const team = {
  membership(agent) {
    const name =
      agent.id === 'lead-1' ? 'lead' : agent.id === 'member-code' ? 'code' : 'art'
    return {
      root: { id: 'lead-1' },
      id: 'team-1',
      role: agent.id === 'lead-1' ? 'lead' : 'teammate',
      name,
    }
  },
  listMembers() {
    return members
  },
  listTasks() {
    return teamTasks
  },
  async updateTask(_caller, request) {
    const task = teamTasks.find((candidate) => candidate.id === request.taskId)
    if (!task) throw new Error('no task')
    if (request.action === 'release') {
      task.ownerName = undefined
      task.status = 'pending'
      task.revision += 1
    }
    return task
  },
  interrupt() {
    return { previousStatus: 'inactive' }
  },
  async sendMessage(caller, request) {
    sentMessages.push({
      from: String(caller.id),
      target: request.target,
      text: request.content?.[0]?.text || '',
    })
    return { messageId: `msg-${sentMessages.length}` }
  },
}

const compaction = { async compactNow() { return {} } }
const leadAgent = {
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
const liveAgents = new Map([
  ['lead-1', leadAgent],
  ['member-code', { id: 'member-code', ctx: {} }],
  ['member-art', { id: 'member-art', ctx: {} }],
])

const ctx = {
  logger: { warn: (...args) => console.log('[warn]', ...args) },
  get(name) {
    if (name === 'agents') return { get: (id) => liveAgents.get(id) || { id } }
    if (name === 'agentTeams') return team
    if (name === 'agentPresets') return { composedPreset: () => '' }
    if (name === 'subagents') {
      return { async drainChildren() {} }
    }
    if (name === 'compaction') return compaction
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
const sessionEvent = events.get('session/event')

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

assert.equal(tools.has('expert_team_close'), true)
assert.equal(tools.has('expert_team_compact'), true)

// code asks art for icons: this is a pending request from code to art.
sessionEvent(
  { id: 'member-art' },
  {
    type: 'user/message',
    time: Date.now(),
    data: {
      source: { kind: 'agent-message', form: 'relay', senderSessionId: 'member-code' },
      content: [{ type: 'text', text: 'Team message from code: 请给我一套塔防图标。' }],
    },
  },
)

// art completes the icon task. The completion fan-out should notify code and
// the Lead, with the notice sent by art itself.
sessionEvent(
  { id: 'lead-1' },
  {
    type: 'team/task',
    time: Date.now(),
    data: {
      version: 2,
      teamId: 'team-1',
      task: {
        id: 'task-2',
        revision: 2,
        subject: '图标资源',
        status: 'completed',
        ownerName: 'art',
        blockedBy: [],
        writeScopes: [],
      },
    },
  },
)

await new Promise((resolve) => setTimeout(resolve, 150))
assert.deepEqual(
  sentMessages.map((message) => message.target).sort(),
  ['code', 'lead'],
)
for (const message of sentMessages) {
  assert.match(message.text, /任务完成/)
  assert.equal(message.from, 'member-art')
}

// interrupt_agent marks a temporary stop; a later delivery clears it.
const toolsResult = events.get('tools/result')
toolsResult(
  { name: 'interrupt_agent', agent: leadAgent, arguments: { target: 'art' } },
  { isError: false },
)
sessionEvent(
  { id: 'member-art' },
  {
    type: 'user/message',
    time: Date.now(),
    data: {
      source: { kind: 'agent-message', form: 'relay', senderSessionId: 'member-code' },
      content: [{ type: 'text', text: 'Team message from code: 继续图标。' }],
    },
  },
)

// The dispatcher deprecates code; a direct user message revives it.
const close = tools.get('expert_team_close')
const closeResult = await close.execute({ target: 'code', reason: '阶段完成' }, {})
assert.equal(closeResult.ok, true)
sessionEvent(
  { id: 'member-code' },
  {
    type: 'user/message',
    time: Date.now(),
    data: {
      source: { kind: 'user' },
      content: [{ type: 'text', text: '我还需要你继续处理登录逻辑。' }],
    },
  },
)

await new Promise((resolve) => setTimeout(resolve, 900))
const ledgerPath = path.join(home, '.dsh-expert-team', 'ledger.json')
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
const row = ledger.teams['lead-1']
assert.ok(row, 'ledger exists')
assert.equal(row.closed?.code, undefined, 'the user revived the deprecated assistant')
assert.equal(row.stopped?.art, undefined, 'a delivery cleared the temporary stop')
assert.equal(
  row.pending?.['code->art']?.text,
  '继续图标。',
  'the completion cleared the first request; the later message opened a new one',
)
assert.ok(row.events.some((event) => event.kind === 'task' && event.status === 'completed'))
assert.ok(row.events.some((event) => event.kind === 'notice' && event.status === 'stopped'))
assert.ok(row.events.some((event) => event.kind === 'user' && event.to === 'code'))
assert.ok(row.events.some((event) => event.kind === 'message' && event.from === 'code' && event.to === 'art'))

fs.rmSync(home, { recursive: true, force: true })
console.log('event smoke test: ok')
