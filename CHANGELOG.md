# Changelog

## 1.0.0 — 2026-11-13

- Initial public release.
- Goal-only expert-team entry: the dispatcher evaluates the goal and assembles the team itself.
- Lead authority: open new experts, deprecate old experts, temporarily stop experts, compact context.
- Per-assistant model selection through `expert_team_models` and `expert_team_open`.
- User authority above the dispatcher: direct chat, intervene, and revive deprecated experts.
- Live event tree with running / blocked-waiting / temporarily-stopped / deprecated colors, current task, selected model, recent events, and click-through to each expert session.
- Task-completion notifications to dependents, recent requesters, and the dispatcher.
- Host and event/model smoke tests.
