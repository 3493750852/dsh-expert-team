window.__ModuleLoader__.load({
  id: 'dsh-expert-team',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'dsh-expert-team'

    const zh = {
      title: '专家团队',
      subtitle: '只需把目标交给调度师；它会评估、组队、建任务并派发。',
      setupTitle: '交给调度师',
      setupHint: '只需填写目标。调度师会评估并组建团队；你随时可以介入，或点开任意助手直接对话。',
      goalLabel: '目标',
      goalPlaceholder: '例如：做一个可联机的塔防小游戏，包含服务端、客户端与美术资源。',
      processGoal: '评估目标',
      processExperts: '决定专家',
      processTeam: '组建团队',
      processDispatch: '按序派发',
      start: '开始评估并组建团队',
      cancel: '取消',
      starting: '正在交给调度师…',
      evaluating: '调度师正在评估目标，决定需要哪些专家…',
      noTasks: '调度师正在评估与拆解任务…',
      dispatchTitle: '派发序列',
      treeTitle: '事件树',
      lead: '调度师',
      leadHint: '接收目标 · 评估组队 · 建任务 · 按序派发',
      goalMissing: '未记录目标',
      memberCount: '位助手',
      closedCount: '已废弃',
      taskCount: '个任务',
      footHint: '用户权限高于调度师：你随时可以介入、改目标或直接和任意助手对话。点击助手打开会话。',
      legend: '状态',
      openSession: '打开会话',
      openHint: '打开该助手的会话，可直接对话',
      you: '你',
      currentTask: '当前',
      waitBlocked: '阻塞',
      waitReply: '等待回复',
      waitDispatch: '等待派发',
      waitContinue: '等待继续',
      noEvents: '还没有事件',
      modelLabel: '模型',
      modelNotApplied: '模型未切换',
      'status.ready': '可开始',
      'status.blocked': '等待依赖',
      'status.pending': '待开始',
      'status.in_progress': '进行中',
      'status.completed': '已完成',
      'status.running': '运行中',
      'status.inactive': '待命',
      'status.provisioning': '创建中',
      'status.failed': '失败',
      'status.closed': '已废弃',
      'status.stopped': '暂时停止',
      'status.waiting': '阻塞 / 等待',
      'status.leading': '统筹中',
      'status.evaluating': '评估中',
      waitingDispatch: '等待调度师派发…',
      working: '正在执行任务…',
      unowned: '未分配',
      errorTitle: '团队初始化有失败项',
      retry: '重试',
      composerUnavailable: '当前输入框不可用，无法发送目标。',
      goalRequired: '请先填写目标。',
      sending: '正在发送…',
      sent: '已发送，调度师正在评估并组建团队…',
      close: '关闭',
      expand: '展开',
      collapse: '收起',
      ledgerUnavailable: '暂时读不到通信记录，任务板仍然可用。',
    }

    const en = {
      title: 'Expert team',
      subtitle: 'Give the dispatcher the goal; it evaluates the work, assembles the team, creates tasks, and assigns them.',
      setupTitle: 'Hand it to the dispatcher',
      setupHint: 'Just describe the goal. The dispatcher decides which experts it needs and assembles the team; you can intervene at any time or open any expert session and chat directly.',
      goalLabel: 'Goal',
      goalPlaceholder: 'For example: build a co-op tower-defense game with server, client, and art.',
      processGoal: 'Evaluate',
      processExperts: 'Choose experts',
      processTeam: 'Assemble',
      processDispatch: 'Assign in order',
      start: 'Start evaluation & assemble',
      cancel: 'Cancel',
      starting: 'Handing it over…',
      evaluating: 'The dispatcher is evaluating the goal and deciding which experts it needs…',
      noTasks: 'The dispatcher is evaluating and breaking the work into tasks…',
      dispatchTitle: 'Dispatch queue',
      treeTitle: 'Event tree',
      lead: 'Dispatcher',
      leadHint: 'Receives the goal · evaluates · assembles · assigns in order',
      goalMissing: 'No goal recorded',
      memberCount: 'experts',
      closedCount: 'deprecated',
      taskCount: 'tasks',
      footHint: 'Your authority outranks the dispatcher: intervene, change the goal, or chat with any expert at any time. Click an expert to open its session.',
      legend: 'Status',
      openSession: 'Open session',
      openHint: 'Open this expert session and chat directly',
      you: 'You',
      currentTask: 'Current',
      waitBlocked: 'Blocked',
      waitReply: 'Waiting for a reply',
      waitDispatch: 'Waiting to be assigned',
      waitContinue: 'Waiting to continue',
      noEvents: 'No events yet',
      modelLabel: 'Model',
      modelNotApplied: 'Model not applied',
      'status.ready': 'Ready',
      'status.blocked': 'Blocked',
      'status.pending': 'Pending',
      'status.in_progress': 'In progress',
      'status.completed': 'Completed',
      'status.running': 'Running',
      'status.inactive': 'Idle',
      'status.provisioning': 'Provisioning',
      'status.failed': 'Failed',
      'status.closed': 'Deprecated',
      'status.stopped': 'Temporarily stopped',
      'status.waiting': 'Blocked / waiting',
      'status.leading': 'Leading',
      'status.evaluating': 'Evaluating',
      waitingDispatch: 'Waiting for the dispatcher…',
      working: 'Working on an assignment…',
      unowned: 'Unassigned',
      errorTitle: 'Some teammates could not be created',
      retry: 'Retry',
      composerUnavailable: 'The composer is unavailable, so the goal could not be sent.',
      goalRequired: 'Please enter a goal first.',
      sending: 'Sending…',
      sent: 'Sent. The dispatcher is evaluating the goal and assembling the team…',
      close: 'Close',
      expand: 'Expand',
      collapse: 'Collapse',
      ledgerUnavailable: 'Communication history is unavailable; the task board still works.',
    }

    function buildKickoff(goal) {
      return [
        '专家团队初始化',
        '目标：',
        goal.trim(),
        '请调度师先评估目标，决定需要哪些专家，自行创建助手并组建团队，然后建任务、按顺序派发。',
      ].join('\n')
    }

    function icon(size) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          'aria-hidden': true,
          className: 'dset_icon',
        },
        h('circle', { cx: 12, cy: 5.5, r: 2.6, fill: 'currentColor' }),
        h('circle', { cx: 5, cy: 18, r: 2.2, fill: 'currentColor', fillOpacity: 0.9 }),
        h('circle', { cx: 12, cy: 18.5, r: 2.2, fill: 'currentColor', fillOpacity: 0.9 }),
        h('circle', { cx: 19, cy: 18, r: 2.2, fill: 'currentColor', fillOpacity: 0.9 }),
        h('path', {
          d: 'M12 8.4v3.1M12 11.5 5.6 15.9M12 11.5l6.4 4.4',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
        }),
      )
    }

    function useLedger(sessionId, active) {
      const [ledger, setLedger] = React.useState(null)
      const [unavailable, setUnavailable] = React.useState(false)
      React.useEffect(() => {
        if (!active || !sessionId) {
          setLedger(null)
          setUnavailable(false)
          return undefined
        }
        let alive = true
        let timer = null
        const load = async () => {
          try {
            const response = await fetch(
              `/dsh-expert-team/ledger?sessionId=${encodeURIComponent(sessionId)}`,
              { cache: 'no-store' },
            )
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const data = await response.json()
            if (!alive) return
            setLedger(data)
            setUnavailable(false)
          } catch {
            if (alive) setUnavailable(true)
          }
          if (alive) timer = window.setTimeout(load, 2500)
        }
        void load()
        return () => {
          alive = false
          if (timer !== null) window.clearTimeout(timer)
        }
      }, [sessionId, active])
      return { ledger, unavailable }
    }

    function formatTime(at) {
      const value = Number(at)
      if (!Number.isFinite(value)) return ''
      try {
        return new Date(value).toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        })
      } catch {
        return ''
      }
    }

    function formatTaskId(id) {
      return `#${String(id || '').replace(/^task-/, '')}`
    }

    function deriveMemberStatus(member, running, tasks, pending, stopped, closed) {
      if (closed) return 'closed'
      if (running === true) return 'running'
      if (member.phase === 'failed') return 'failed'
      if (member.phase === 'provisioning') return 'provisioning'
      if (stopped) return 'stopped'
      const owned = (tasks || []).filter((task) => task.ownerName === member.name)
      if (owned.some((task) => task.status === 'pending' && !task.ready)) return 'waiting'
      const pendingValues = Object.values(pending || {})
      if (
        pendingValues.some(
          (request) => request.from === member.name && request.to !== member.name,
        )
      ) {
        return 'waiting'
      }
      if (
        owned.some(
          (task) =>
            task.status === 'in_progress' ||
            (task.status === 'pending' && task.ready === true),
        )
      ) {
        return 'waiting'
      }
      return 'inactive'
    }

    function memberWaitReason(member, tasks, pending, status, t) {
      if (status !== 'waiting') return ''
      const owned = (tasks || []).filter((task) => task.ownerName === member.name)
      const blocked = owned.find((task) => task.status === 'pending' && !task.ready)
      if (blocked) {
        const blockers = Array.isArray(blocked.blockedBy) && blocked.blockedBy.length > 0
          ? ` ${blocked.blockedBy.map(formatTaskId).join(', ')}`
          : ''
        return `${t('waitBlocked')}${blockers}`
      }
      const request = Object.values(pending || {}).find(
        (candidate) => candidate.from === member.name && candidate.to !== member.name,
      )
      if (request) return `${t('waitReply')}：${request.to}`
      const ready = owned.find((task) => task.status === 'pending' && task.ready === true)
      if (ready) return `${t('waitDispatch')}：${formatTaskId(ready.id)}`
      const active = owned.find((task) => task.status === 'in_progress')
      if (active) return `${t('waitContinue')}：${formatTaskId(active.id)}`
      return ''
    }

    function EventRow({ event, memberName, t }) {
      const at = formatTime(event.at)
      const isUser = event.kind === 'user'
      const isTask = event.kind === 'task'
      const isMember = event.kind === 'member'
      const isNotice = event.kind === 'notice'
      let mark = ''
      let className = 'dset_event'
      if (isUser) {
        mark = t('you')
        className += ' dset_eventUser'
      } else if (isTask) {
        mark = formatTaskId(event.taskId || '')
        className += ` dset_eventTask dset_eventTask-${event.status || 'pending'}`
      } else if (isMember) {
        mark = '·'
        className += ' dset_eventMember'
      } else if (isNotice) {
        mark = '!'
        className += event.status === 'stopped' ? ' dset_eventStopped' : ' dset_eventNotice'
      } else {
        const outgoing = event.from === memberName
        const other = outgoing ? event.to : event.from
        const otherLabel = other === 'lead' ? t('lead') : other
        mark = outgoing ? `→ ${otherLabel}` : `← ${otherLabel}`
      }
      return h(
        'div',
        { className },
        at ? h('span', { className: 'dset_eventTime' }, at) : null,
        mark ? h('span', { className: 'dset_eventMark' }, mark) : null,
        h('span', { className: 'dset_eventText', title: event.text }, event.text),
      )
    }

    function MemberRow({
      member,
      isLast,
      events,
      tasks,
      pending,
      models,
      stopped,
      closed,
      useSessionStatus,
      useSessions,
      onOpenMember,
      t,
    }) {
      const running = useSessionStatus((state) => state.get(member.id)?.running)
      const summaryRunning = useSessions((state) => state.byId?.[member.id]?.running)
      const liveModel = useSessions(
        (state) => state?.projectionsBySession?.[member.id]?.values?.modelSelection?.next?.model,
      )
      const selectedModel = models?.[member.name]
      const modelLabel = selectedModel?.model
        ? `${selectedModel.provider ? `${selectedModel.provider}/` : ''}${selectedModel.model}`
        : liveModel || ''
      const modelTitle =
        selectedModel?.selected === false ? t('modelNotApplied') : t('modelLabel')
      const activeRunning = (running ?? summaryRunning) === true
      const status = deriveMemberStatus(
        member,
        activeRunning,
        tasks,
        pending,
        stopped,
        closed,
      )
      const statusKey = `status.${status}`
      const waitReason = memberWaitReason(member, tasks, pending, status, t)
      const owned = (tasks || []).filter((task) => task.ownerName === member.name)
      const currentTask =
        owned.find((task) => task.status === 'in_progress') ||
        owned.find((task) => task.status === 'pending' && task.ready === true)
      const detail =
        status === 'closed'
          ? ''
          : waitReason ||
            (currentTask
              ? `${t('currentTask')}：${formatTaskId(currentTask.id)} ${currentTask.subject || ''}`
              : '')
      const nodeEvents = (events || [])
        .filter((event) => event.from === member.name || event.to === member.name)
        .slice(-4)
      return h(
        'div',
        {
          className: [
            'dset_branch',
            isLast ? 'dset_branchLast' : '',
            closed ? 'dset_branchClosed' : '',
          ]
            .filter(Boolean)
            .join(' '),
        },
        h(
          'div',
          { className: 'dset_branchHead' },
          h('span', { className: 'dset_connector', 'aria-hidden': true }, isLast ? '└─' : '├─'),
          h('span', { className: `dset_dot dset_dot-${status}` }),
          h('span', { className: 'dset_memberName' }, member.name),
          h('span', { className: `dset_status dset_status-${status}` }, t(statusKey)),
          onOpenMember
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'dset_open',
                  title: t('openHint'),
                  'aria-label': `${t('openSession')}: ${member.name}`,
                  onClick: () => onOpenMember(member.id),
                },
                '↗',
              )
            : null,
        ),
        detail ? h('div', { className: `dset_detail dset_detail-${status}` }, detail) : null,
        member.description || modelLabel
          ? h(
              'div',
              { className: 'dset_descRow' },
              member.description
                ? h(
                    'span',
                    { className: 'dset_desc', title: member.description },
                    member.description,
                  )
                : h('span', { className: 'dset_desc' }),
              modelLabel
                ? h(
                    'span',
                    {
                      className:
                        selectedModel?.selected === false
                          ? 'dset_model dset_modelPending'
                          : 'dset_model',
                      title: modelTitle,
                    },
                    modelLabel,
                  )
                : null,
            )
          : null,
        h(
          'div',
          { className: 'dset_msgs' },
          nodeEvents.length === 0
            ? h(
                'div',
                { className: 'dset_msgsEmpty' },
                closed
                  ? t('status.closed')
                  : status === 'running'
                    ? t('working')
                    : status === 'stopped' ||
                        status === 'waiting' ||
                        status === 'provisioning' ||
                        status === 'failed'
                      ? t(statusKey)
                      : t('waitingDispatch'),
              )
            : nodeEvents.map((event) =>
                h(EventRow, { key: event.seq, event, memberName: member.name, t }),
              ),
        ),
      )
    }

    function TaskRow({ task, t }) {
      const match = /^task-(\d+)$/.exec(String(task.id || ''))
      const number = match ? match[1] : String(task.id || '?')
      const owner =
        task.ownerName === 'lead'
          ? t('lead')
          : task.ownerName
            ? `@${task.ownerName}`
            : t('unowned')
      const statusKey =
        task.status === 'pending'
          ? task.ready
            ? 'status.ready'
            : 'status.blocked'
          : task.status === 'in_progress'
            ? 'status.in_progress'
            : task.status === 'completed'
              ? 'status.completed'
              : 'status.pending'
      return h(
        'div',
        { className: `dset_task dset_task-${task.status || 'pending'}` },
        h('span', { className: 'dset_taskNo' }, `#${number}`),
        h(
          'div',
          { className: 'dset_taskMain' },
          h('div', { className: 'dset_taskSubject', title: task.subject }, task.subject),
          h(
            'div',
            { className: 'dset_taskMeta' },
            h('span', { className: 'dset_taskOwner' }, owner),
            h('span', null, t(statusKey)),
            Array.isArray(task.blockedBy) && task.blockedBy.length > 0
              ? h('span', null, `${task.blockedBy.join(', ')}`)
              : null,
          ),
        ),
        h('span', { className: `dset_statusDot dset_statusDot-${task.status || 'pending'}` }),
      )
    }

    function LeadRow({ lead, evaluating, events, useSessionStatus, t }) {
      const running = useSessionStatus((state) =>
        lead?.id ? state.get(lead.id)?.running : undefined,
      )
      const status = running === true ? 'running' : evaluating ? 'waiting' : 'inactive'
      const statusKey =
        status === 'running'
          ? 'status.leading'
          : evaluating
            ? 'status.evaluating'
            : 'status.inactive'
      const leadEvents = (events || [])
        .filter((event) => event.from === 'lead' || event.to === 'lead')
        .slice(-2)
      return h(
        'div',
        { className: 'dset_leadWrap' },
        h(
          'div',
          { className: 'dset_lead' },
          h('span', { className: `dset_dot dset_dot-${status}` }),
          h('span', { className: 'dset_leadName' }, t('lead')),
          h('code', { className: 'dset_code' }, lead?.name || 'lead'),
          h('span', { className: `dset_status dset_status-${status}` }, t(statusKey)),
          h('span', { className: 'dset_leadHint' }, t('leadHint')),
        ),
        leadEvents.length > 0
          ? h(
              'div',
              { className: 'dset_leadEvents' },
              leadEvents.map((event) =>
                h(EventRow, { key: event.seq, event, memberName: 'lead', t }),
              ),
            )
          : null,
      )
    }

    function TeamPanel({
      team,
      ledger,
      unavailable,
      expanded,
      setExpanded,
      useSessionStatus,
      useSessions,
      onOpenMember,
      t,
    }) {
      const members = Array.isArray(team?.members) ? team.members : []
      const tasks = Array.isArray(team?.tasks) ? team.tasks : []
      const lead = members.find((member) => member.role === 'lead') || members[0] || null
      const assistants = members.filter((member) => member.role !== 'lead')
      const closed = ledger?.closed && typeof ledger.closed === 'object' ? ledger.closed : {}
      const stopped = ledger?.stopped && typeof ledger.stopped === 'object' ? ledger.stopped : {}
      const pending = ledger?.pending && typeof ledger.pending === 'object' ? ledger.pending : {}
      const models = ledger?.models && typeof ledger.models === 'object' ? ledger.models : {}
      const activeAssistants = assistants.filter((member) => !closed[member.name])
      const closedCount = assistants.length - activeAssistants.length
      const sortedTasks = [...tasks].sort((a, b) => {
        const left = Number((/^task-(\d+)$/.exec(String(a.id || '')) || [])[1] || 0)
        const right = Number((/^task-(\d+)$/.exec(String(b.id || '')) || [])[1] || 0)
        return left - right
      })
      const done = tasks.filter((task) => task.status === 'completed').length
      const events = Array.isArray(ledger?.events) ? ledger.events : []
      const goal = ledger?.goal || ''
      const errors = Array.isArray(ledger?.errors) ? ledger.errors : []
      const anyRunning = tasks.some((task) => task.status === 'in_progress')
      const evaluating = assistants.length === 0 && tasks.length === 0
      const legend = ['running', 'waiting', 'stopped', 'closed']

      return h(
        'section',
        { className: 'dset_panel', 'aria-label': t('title') },
        h(
          'div',
          { className: 'dset_head' },
          h(
            'button',
            {
              type: 'button',
              className: 'dset_chevron',
              'aria-expanded': expanded,
              'aria-label': expanded ? t('collapse') : t('expand'),
              onClick: () => setExpanded((value) => !value),
            },
            expanded ? '▾' : '▸',
          ),
          h('span', { className: 'dset_mark' }, icon(17)),
          h(
            'div',
            { className: 'dset_headMain' },
            h(
              'div',
              { className: 'dset_headTitle' },
              h('span', { className: 'dset_title' }, t('title')),
              h(
                'span',
                { className: 'dset_chip' },
                `${activeAssistants.length} ${t('memberCount')}`,
              ),
              closedCount > 0
                ? h(
                    'span',
                    { className: 'dset_chip dset_chipClosed' },
                    `${closedCount} ${t('closedCount')}`,
                  )
                : null,
              h('span', { className: 'dset_chip' }, `${done}/${tasks.length} ${t('taskCount')}`),
              anyRunning
                ? h('span', { className: 'dset_live', 'aria-label': t('status.running') })
                : evaluating
                  ? h('span', {
                      className: 'dset_live dset_live-waiting',
                      'aria-label': t('status.evaluating'),
                    })
                  : null,
            ),
            h('div', { className: 'dset_goal', title: goal }, goal || t('goalMissing')),
          ),
        ),
        errors.length > 0
          ? h(
              'div',
              { className: 'dset_error' },
              `${t('errorTitle')}：${errors.map((error) => error.message).join('；')}`,
            )
          : null,
        team?.failure ? h('div', { className: 'dset_error' }, String(team.failure)) : null,
        expanded
          ? h(
              'div',
              { className: 'dset_body' },
              h(
                'section',
                { className: 'dset_treePane' },
                h('div', { className: 'dset_sectionLabel' }, t('treeTitle')),
                h(
                  'div',
                  { className: 'dset_tree' },
                  h(LeadRow, {
                    lead,
                    evaluating,
                    events,
                    useSessionStatus,
                    t,
                  }),
                  assistants.length === 0
                    ? h('div', { className: 'dset_waiting' }, t('evaluating'))
                    : assistants.map((member, index) =>
                        h(MemberRow, {
                          key: member.id || member.name,
                          member,
                          isLast: index === assistants.length - 1,
                          events,
                          tasks,
                          pending,
                          models,
                          stopped: Boolean(stopped[member.name]),
                          closed: Boolean(closed[member.name]),
                          useSessionStatus,
                          useSessions,
                          onOpenMember,
                          t,
                        }),
                      ),
                ),
              ),
              h(
                'section',
                { className: 'dset_taskPane' },
                h(
                  'div',
                  { className: 'dset_sectionLabel' },
                  t('dispatchTitle'),
                  h('span', { className: 'dset_sectionCount' }, `${done}/${tasks.length}`),
                ),
                sortedTasks.length === 0
                  ? h('div', { className: 'dset_waiting' }, t('noTasks'))
                  : h(
                      'div',
                      { className: 'dset_tasks' },
                      sortedTasks.map((task) => h(TaskRow, { key: task.id, task, t })),
                    ),
              ),
            )
          : null,
        expanded
          ? h(
              'div',
              { className: 'dset_foot' },
              h(
                'div',
                { className: 'dset_legend', 'aria-label': t('legend') },
                legend.map((status) =>
                  h(
                    'span',
                    { className: 'dset_legendItem', key: status },
                    h('span', { className: `dset_dot dset_dot-${status}` }),
                    t(`status.${status}`),
                  ),
                ),
              ),
              h(
                'div',
                { className: 'dset_footHint', title: unavailable ? t('ledgerUnavailable') : t('footHint') },
                unavailable ? t('ledgerUnavailable') : t('footHint'),
              ),
            )
          : null,
      )
    }

    function SetupCard({ busy, error, onCancel, onStart, t }) {
      const [goal, setGoal] = React.useState('')
      const [localError, setLocalError] = React.useState('')

      const submit = () => {
        setLocalError('')
        if (!goal.trim()) {
          setLocalError(t('goalRequired'))
          return
        }
        onStart(goal.trim())
      }

      const processSteps = [t('processGoal'), t('processExperts'), t('processTeam'), t('processDispatch')]

      return h(
        'section',
        { className: 'dset_setup', 'aria-label': t('setupTitle') },
        h(
          'div',
          { className: 'dset_setupHead' },
          h('span', { className: 'dset_mark' }, icon(18)),
          h(
            'div',
            { className: 'dset_setupHeadText' },
            h('div', { className: 'dset_setupTitle' }, t('setupTitle')),
            h('div', { className: 'dset_setupSub' }, t('subtitle')),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dset_close',
              onClick: onCancel,
              disabled: busy,
              title: t('close'),
              'aria-label': t('close'),
            },
            '×',
          ),
        ),
        h(
          'label',
          { className: 'dset_field' },
          h('span', { className: 'dset_label' }, t('goalLabel')),
          h('textarea', {
            className: 'dset_goalInput',
            rows: 4,
            value: goal,
            placeholder: t('goalPlaceholder'),
            disabled: busy,
            onChange: (event) => setGoal(event.target.value),
          }),
        ),
        h(
          'div',
          { className: 'dset_process' },
          processSteps.map((step, index) =>
            h(
              React.Fragment,
              { key: step },
              index > 0 ? h('span', { className: 'dset_processArrow', 'aria-hidden': true }, '→') : null,
              h('span', { className: 'dset_processStep' }, step),
            ),
          ),
        ),
        localError || error ? h('div', { className: 'dset_error' }, localError || error) : null,
        h(
          'div',
          { className: 'dset_setupFoot' },
          h('div', { className: 'dset_setupHint' }, t('setupHint')),
          h(
            'div',
            { className: 'dset_actions' },
            h(
              'button',
              { type: 'button', className: 'dset_ghost', onClick: onCancel, disabled: busy },
              t('cancel'),
            ),
            h(
              'button',
              { type: 'button', className: 'dset_primary', onClick: submit, disabled: busy },
              busy ? t('starting') : t('start'),
            ),
          ),
        ),
      )
    }

    function ExpertTeamDock(props) {
      const { sessionId, useSession, useSessions, useSessionStatus, inputActions, onOpenMember, t } = props
      const leadSessionId =
        useSession((snapshot) => snapshot?.subagent?.address?.parentSessionId) || sessionId
      const team = useSessions(
        (state) => state?.projectionsBySession?.[leadSessionId]?.values?.agentTeam,
      )
      const preset = useSessions(
        (state) => state?.byId?.[leadSessionId]?.projectionValues?.agentPreset,
      )
      const members = Array.isArray(team?.members) ? team.members : []
      const tasks = Array.isArray(team?.tasks) ? team.tasks : []
      const teamActive = members.length > 1 || tasks.length > 0
      const [setupOpen, setSetupOpen] = React.useState(false)
      const [expanded, setExpanded] = React.useState(true)
      const [submitting, setSubmitting] = React.useState(false)
      const [error, setError] = React.useState('')
      const watchLedger = teamActive || preset === 'expert-team' || setupOpen || submitting
      const { ledger, unavailable } = useLedger(leadSessionId, watchLedger)
      const modeActive = ledger?.mode === 'expert-team'
      const active = teamActive || modeActive

      React.useEffect(() => {
        if (!active && preset === 'expert-team') setSetupOpen(true)
      }, [active, preset])

      React.useEffect(() => {
        if (active) {
          setExpanded(true)
          setSetupOpen(false)
          setSubmitting(false)
        }
      }, [active])

      React.useEffect(() => {
        if (!submitting) return undefined
        const timer = window.setTimeout(() => setSubmitting(false), 20000)
        return () => window.clearTimeout(timer)
      }, [submitting])

      const startTeam = (goal) => {
        if (
          !inputActions ||
          typeof inputActions.setDraft !== 'function' ||
          typeof inputActions.submit !== 'function'
        ) {
          setError(t('composerUnavailable'))
          return
        }
        const text = buildKickoff(goal)
        setSubmitting(true)
        setError('')
        try {
          inputActions.setDraft(text)
          window.setTimeout(() => {
            try {
              inputActions.submit()
            } catch (reason) {
              setSubmitting(false)
              setError(String(reason?.message || reason))
            }
          }, 40)
        } catch (reason) {
          setSubmitting(false)
          setError(String(reason?.message || reason))
        }
      }

      if (active) {
        return h(
          'div',
          { className: 'dset_dock' },
          h(TeamPanel, {
            team,
            ledger,
            unavailable,
            expanded,
            setExpanded,
            useSessionStatus,
            useSessions,
            onOpenMember: onOpenMember
              ? (memberId) => onOpenMember(leadSessionId, memberId)
              : undefined,
            t,
          }),
        )
      }

      if (setupOpen) {
        return h(
          'div',
          { className: 'dset_dock' },
          h(SetupCard, {
            busy: submitting,
            error,
            onCancel: () => {
              setSetupOpen(false)
              setError('')
            },
            onStart: startTeam,
            t,
          }),
        )
      }

      return null
    }

    const CSS = `
      .dset_dock {
        width: 100%;
        box-sizing: border-box;
        padding: 2px 0 6px;
        font-size: 13px;
        line-height: 1.45;
        color: var(--dsw-alias-label-secondary);
        font-family: inherit;
      }
      .dset_icon { flex: 0 0 auto; display: block; }
      .dset_setup, .dset_panel {
        border: 1px solid var(--dsw-alias-border-l1);
        background: var(--dsw-alias-bg-layer-1);
        border-radius: 12px;
        box-shadow: 0 6px 22px rgba(15, 23, 42, .08);
        overflow: hidden;
      }
      .dset_setup { padding: 12px 14px 11px; }
      .dset_setupHead { display: flex; align-items: flex-start; gap: 9px; }
      .dset_mark {
        width: 28px; height: 28px; flex: 0 0 auto;
        display: inline-flex; align-items: center; justify-content: center;
        border-radius: 8px;
        background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
        color: var(--dsw-alias-brand-primary);
      }
      .dset_setupHeadText { min-width: 0; flex: 1; }
      .dset_setupTitle { font-weight: 650; color: var(--dsw-alias-label-primary); font-size: 13.5px; }
      .dset_setupSub { color: var(--dsw-alias-label-tertiary); font-size: 11.5px; margin-top: 1px; }
      .dset_close {
        border: 0; background: transparent; color: var(--dsw-alias-label-tertiary);
        font-size: 18px; line-height: 1; cursor: pointer; padding: 2px 4px; border-radius: 6px;
      }
      .dset_close:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); }
      .dset_field { display: block; margin-top: 10px; }
      .dset_label {
        display: block; font-size: 11.5px; font-weight: 600;
        color: var(--dsw-alias-label-secondary); margin-bottom: 4px;
      }
      .dset_goalInput {
        width: 100%; box-sizing: border-box; resize: vertical; min-height: 78px;
        border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px;
        background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
        padding: 7px 9px; font: inherit; font-size: 12.5px; line-height: 1.5; outline: none;
      }
      .dset_goalInput:focus { border-color: var(--dsw-alias-brand-primary); }
      .dset_process {
        display: flex; flex-wrap: wrap; align-items: center; gap: 4px;
        margin-top: 8px; color: var(--dsw-alias-label-tertiary); font-size: 10.5px;
      }
      .dset_processStep {
        border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px;
        padding: 1px 7px; line-height: 17px; color: var(--dsw-alias-label-secondary);
      }
      .dset_processArrow { opacity: .55; }
      .dset_setupFoot { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-top: 10px; }
      .dset_setupHint { color: var(--dsw-alias-label-tertiary); font-size: 11px; max-width: 62%; }
      .dset_actions { display: flex; align-items: center; gap: 7px; flex: 0 0 auto; }
      .dset_ghost, .dset_primary {
        border-radius: 8px; padding: 5px 11px; font: inherit; font-size: 12px; cursor: pointer;
      }
      .dset_ghost {
        border: 1px solid var(--dsw-alias-border-l1); background: transparent;
        color: var(--dsw-alias-label-secondary);
      }
      .dset_ghost:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
      .dset_primary {
        border: 1px solid transparent; background: var(--dsw-alias-brand-primary); color: #fff; font-weight: 600;
      }
      .dset_primary:hover { filter: brightness(1.06); }
      .dset_ghost:disabled, .dset_primary:disabled { opacity: .5; cursor: default; }
      .dset_error {
        margin-top: 8px; padding: 6px 8px; border-radius: 7px;
        color: var(--dsw-alias-state-error-primary);
        background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 9%, transparent);
        font-size: 11.5px; line-height: 1.5;
      }
      .dset_panel { border-radius: 12px; }
      .dset_head { display: flex; align-items: center; gap: 8px; padding: 8px 11px; }
      .dset_chevron {
        border: 0; background: transparent; color: var(--dsw-alias-label-tertiary);
        font-size: 11px; cursor: pointer; padding: 2px 1px; line-height: 1;
      }
      .dset_chevron:hover { color: var(--dsw-alias-label-primary); }
      .dset_headMain { min-width: 0; flex: 1; }
      .dset_headTitle { display: flex; align-items: center; gap: 6px; min-width: 0; }
      .dset_title { font-weight: 650; color: var(--dsw-alias-label-primary); font-size: 13px; }
      .dset_chip {
        color: var(--dsw-alias-label-tertiary); font-size: 10.5px;
        border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px; padding: 0 6px; line-height: 16px;
        white-space: nowrap;
      }
      .dset_chipClosed { opacity: .65; }
      .dset_live {
        width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-success-primary);
        animation: dset-pulse 1.6s ease-in-out infinite;
      }
      .dset_live-waiting { background: var(--dsw-alias-state-warn-primary); animation: none; }
      .dset_goal {
        color: var(--dsw-alias-label-tertiary); font-size: 11.5px; margin-top: 1px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .dset_body {
        display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(230px, .9fr);
        gap: 12px; padding: 0 11px 8px; max-height: 330px; overflow: auto;
      }
      .dset_treePane, .dset_taskPane { min-width: 0; }
      .dset_sectionLabel {
        display: flex; align-items: center; gap: 6px;
        font-size: 10.5px; font-weight: 650; letter-spacing: .02em;
        color: var(--dsw-alias-label-tertiary); text-transform: uppercase; margin: 2px 0 6px;
      }
      .dset_sectionCount { font-weight: 500; opacity: .8; }
      .dset_tree { position: relative; padding-left: 2px; }
      .dset_lead, .dset_branchHead { display: flex; align-items: center; gap: 6px; min-width: 0; }
      .dset_lead { padding: 2px 0 4px; }
      .dset_leadName { font-weight: 650; color: var(--dsw-alias-label-primary); font-size: 12.5px; }
      .dset_code {
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 10.5px; color: var(--dsw-alias-label-tertiary);
        border: 1px solid var(--dsw-alias-border-l1); border-radius: 5px; padding: 0 4px;
      }
      .dset_leadHint { color: var(--dsw-alias-label-tertiary); font-size: 10.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dset_dot { width: 7px; height: 7px; border-radius: 50%; flex: 0 0 auto; box-sizing: border-box; background: var(--dsw-alias-state-idle-primary); }
      .dset_dot-lead, .dset_dot-running { background: var(--dsw-alias-state-success-primary); }
      .dset_dot-running { animation: dset-pulse 1.15s ease-in-out infinite; }
      .dset_dot-waiting, .dset_dot-provisioning { background: var(--dsw-alias-state-warn-primary); }
      .dset_dot-stopped, .dset_dot-failed { background: var(--dsw-alias-state-error-primary); }
      .dset_dot-closed { background: var(--dsw-alias-state-idle-primary); opacity: .45; }
      .dset_dot-inactive { background: transparent; border: 1.5px solid var(--dsw-alias-state-idle-primary); }
      .dset_branch {
        margin-left: 7px; padding: 3px 0 4px 14px;
        border-left: 1px solid var(--dsw-alias-border-l1);
        position: relative;
      }
      .dset_branchLast { padding-bottom: 2px; }
      .dset_branchClosed { opacity: .55; }
      .dset_connector {
        position: absolute; left: 0; top: 6px; transform: translateX(-50%);
        color: var(--dsw-alias-border-l2); font-family: ui-monospace, Consolas, monospace;
        font-size: 10px; background: var(--dsw-alias-bg-layer-1); padding: 1px 0; line-height: 1;
      }
      .dset_memberName { font-weight: 600; color: var(--dsw-alias-label-primary); font-size: 12px; }
      .dset_status { font-size: 10.5px; color: var(--dsw-alias-label-tertiary); margin-left: auto; white-space: nowrap; }
      .dset_status-running { color: var(--dsw-alias-state-success-primary); }
      .dset_status-provisioning { color: var(--dsw-alias-state-warn-primary); }
      .dset_status-waiting { color: var(--dsw-alias-state-warn-primary); }
      .dset_status-stopped { color: var(--dsw-alias-state-error-primary); }
      .dset_status-failed { color: var(--dsw-alias-state-error-primary); }
      .dset_status-closed { color: var(--dsw-alias-label-tertiary); }
      .dset_open {
        border: 0; background: transparent; color: var(--dsw-alias-label-tertiary);
        cursor: pointer; font: inherit; font-size: 11px; line-height: 1; padding: 2px 3px;
        border-radius: 4px; flex: 0 0 auto;
      }
      .dset_open:hover { color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-bg-layer-2); }
      .dset_desc {
        color: var(--dsw-alias-label-tertiary); font-size: 10.5px; margin: 1px 0 0 13px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .dset_descRow {
        display: flex; align-items: center; gap: 6px; margin: 1px 0 0 13px; min-width: 0;
      }
      .dset_descRow .dset_desc { flex: 1; min-width: 0; margin: 0; }
      .dset_model {
        flex: 0 0 auto; max-width: 46%; font-size: 9.5px; line-height: 15px;
        color: var(--dsw-alias-label-tertiary);
        border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px; padding: 0 5px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      }
      .dset_modelPending {
        color: var(--dsw-alias-state-warn-primary);
        border-color: var(--dsw-alias-state-warn-primary);
      }
      .dset_detail {
        color: var(--dsw-alias-label-secondary); font-size: 10px; margin: 1px 0 0 13px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .dset_detail-waiting { color: var(--dsw-alias-state-warn-primary); }
      .dset_detail-stopped { color: var(--dsw-alias-state-error-primary); }
      .dset_detail-closed { color: var(--dsw-alias-label-tertiary); }
      .dset_leadEvents { margin: 0 0 2px 13px; display: flex; flex-direction: column; gap: 2px; }
      .dset_msgs { margin: 3px 0 0 13px; display: flex; flex-direction: column; gap: 2px; }
      .dset_msgsEmpty { color: var(--dsw-alias-label-tertiary); font-size: 10.5px; font-style: italic; opacity: .8; }
      .dset_event { display: flex; align-items: baseline; gap: 4px; min-width: 0; font-size: 10.5px; line-height: 1.4; }
      .dset_eventTime {
        color: var(--dsw-alias-label-tertiary); opacity: .72; font-size: 9.5px;
        font-variant-numeric: tabular-nums; flex: 0 0 auto;
      }
      .dset_eventMark {
        color: var(--dsw-alias-label-secondary); font-weight: 600; flex: 0 0 auto;
        max-width: 88px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .dset_eventText {
        color: var(--dsw-alias-label-tertiary); overflow: hidden; text-overflow: ellipsis;
        white-space: nowrap; min-width: 0;
      }
      .dset_eventUser .dset_eventMark { color: var(--dsw-alias-brand-primary); }
      .dset_eventUser .dset_eventText { color: var(--dsw-alias-label-primary); }
      .dset_eventTask .dset_eventMark { color: var(--dsw-alias-brand-primary); }
      .dset_eventTask-completed .dset_eventMark { color: var(--dsw-alias-state-success-primary); }
      .dset_eventTask-in_progress .dset_eventMark { color: var(--dsw-alias-state-success-primary); }
      .dset_eventMember { opacity: .72; }
      .dset_eventStopped .dset_eventMark, .dset_eventStopped .dset_eventText { color: var(--dsw-alias-state-error-primary); }
      .dset_eventNotice .dset_eventMark { color: var(--dsw-alias-state-warn-primary); }
      .dset_msg { display: flex; align-items: baseline; gap: 4px; min-width: 0; font-size: 11px; }
      .dset_arrow { color: var(--dsw-alias-brand-primary); flex: 0 0 auto; font-size: 10px; }
      .dset_msgWho { color: var(--dsw-alias-label-secondary); font-weight: 600; flex: 0 0 auto; max-width: 82px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dset_msgText { color: var(--dsw-alias-label-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dset_waiting { color: var(--dsw-alias-label-tertiary); font-size: 11.5px; font-style: italic; padding: 4px 0 2px; }
      .dset_tasks { display: flex; flex-direction: column; gap: 4px; }
      .dset_task {
        display: flex; align-items: center; gap: 7px; padding: 5px 7px;
        border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px;
        background: var(--dsw-alias-bg-base); min-width: 0;
      }
      .dset_task-completed { opacity: .75; }
      .dset_taskNo {
        font-family: ui-monospace, Consolas, monospace; font-size: 10px;
        color: var(--dsw-alias-label-tertiary); flex: 0 0 auto;
      }
      .dset_taskMain { min-width: 0; flex: 1; }
      .dset_taskSubject {
        color: var(--dsw-alias-label-primary); font-size: 11.5px; font-weight: 550;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .dset_taskMeta {
        display: flex; align-items: center; gap: 7px; min-width: 0;
        color: var(--dsw-alias-label-tertiary); font-size: 10px; margin-top: 1px;
      }
      .dset_taskOwner { color: var(--dsw-alias-label-secondary); font-weight: 600; }
      .dset_statusDot { width: 6px; height: 6px; border-radius: 50%; flex: 0 0 auto; background: var(--dsw-alias-state-idle-primary); }
      .dset_statusDot-in_progress { background: var(--dsw-alias-state-success-primary); animation: dset-pulse 1.5s ease-in-out infinite; }
      .dset_statusDot-completed { background: var(--dsw-alias-state-success-primary); opacity: .55; }
      .dset_statusDot-pending { background: var(--dsw-alias-state-idle-primary); }
      .dset_foot { padding: 0 11px 8px; color: var(--dsw-alias-label-tertiary); font-size: 10.5px; display: flex; flex-direction: column; gap: 4px; }
      .dset_legend { display: flex; flex-wrap: wrap; align-items: center; gap: 9px; font-size: 10px; color: var(--dsw-alias-label-tertiary); }
      .dset_legendItem { display: inline-flex; align-items: center; gap: 4px; }
      .dset_legendItem .dset_dot { width: 6px; height: 6px; }
      .dset_footHint { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      @keyframes dset-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
      @media (max-width: 720px) {
        .dset_body { grid-template-columns: 1fr; max-height: 300px; }
        .dset_setupFoot { flex-direction: column; align-items: stretch; }
        .dset_setupHint { max-width: none; }
        .dset_actions { justify-content: flex-end; }
      }
    `

    function installStyles() {
      const previous = document.querySelector('style[data-dsh-expert-team]')
      if (previous) previous.remove()
      const tag = document.createElement('style')
      tag.dataset.dshExpertTeam = '1'
      tag.textContent = CSS
      document.head.appendChild(tag)
      return () => {
        tag.remove()
      }
    }

    const inject = ['sessions', 'slots', 'locale', 'uiWorkspace']

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-expert-team: dictionaries')
      const t = ctx.locale.bind(NS)

      ctx.effect(() => installStyles(), 'dsh-expert-team: styles')

      const openMember = (leadId, memberId) => {
        try {
          const retained = ctx.sessions
            ?.retainInfo?.(leadId)
            ?.getSnapshot?.()?.retainedBy?.mainView
          if (retained === 0) return
          if (!ctx.uiWorkspace?.openSession) return
          if (memberId === leadId) {
            ctx.uiWorkspace.openSession(leadId)
          } else {
            ctx.uiWorkspace.openSession({
              parentSessionId: leadId,
              childSessionId: memberId,
              mode: 'continuable',
            })
          }
        } catch (error) {
          try {
            console.error('dsh-expert-team: could not open the expert session', error)
          } catch {
            // Console may be unavailable.
          }
        }
      }

      ctx.effect(
        () =>
          ctx.slots.inject('conversation.input.dock', () =>
            ctx.slots.register(
              {
                name: 'conversation.input.dock',
                id: 'dsh-expert-team',
                order: 15,
                locale: NS,
              },
              (props) => h(ExpertTeamDock, { ...props, t, onOpenMember: openMember }),
            ),
          ),
        'dsh-expert-team: composer dock',
      )
    }

    return { inject, apply }
  },
})
