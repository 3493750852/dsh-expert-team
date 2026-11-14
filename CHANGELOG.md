# Changelog

## 1.1.1 — 2026-11-14

- Ordinary conversations can no longer assemble a team on their own: a Host team gate (`expert-team/gate`) rejects `spawn_teammate`, `expert_team_open`, `team_task_create`, `team_task_update`, and the team-member forms of `send_message` / `interrupt_agent`.
- The gate stays open only for a real expert-team session (the preset chosen at creation or the user's own kickoff message).
- Added a compact 「专家团队」 button in the composer tool row of ordinary conversations; the user opens the goal card and submits it to enable the team. The assistant cannot do this for the user.
- Non-team work is untouched: file writes, shell commands, and one-shot `subagent` / `subagent_fork` delegation still work, and the subagent `send_message` form (`agent_id`) is not gated.
- `GET /dsh-expert-team/ledger` now reports `teamGate` for the session.
- Added `test/gate-smoke.mjs`.

## 1.0.0 — 2026-11-13

- Initial public release.
- Goal-only expert-team entry: the dispatcher evaluates the goal and assembles the team itself.
- Lead authority: open new experts, deprecate old experts, temporarily stop experts, compact context.
- Per-assistant model selection through `expert_team_models` and `expert_team_open`.
- User authority above the dispatcher: direct chat, intervene, and revive deprecated experts.
- Live event tree with running / blocked-waiting / temporarily-stopped / deprecated colors, current task, selected model, recent events, and click-through to each expert session.
- Task-completion notifications to dependents, recent requesters, and the dispatcher.
- Host and event/model smoke tests.
