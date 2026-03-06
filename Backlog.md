# contenz Backlog

This backlog is the short-horizon execution queue. It should stay actionable and readable. Large speculative scope belongs in `PROJECT_SCOPE.md`; milestone sequencing belongs in `ROADMAP.md`.

## Current Focus

Milestone 1 is complete. Current focus is Milestone 2: incremental build and watch workflows.

Near-term boundary: implement through Milestone 3, then do a documentation and API stabilization pass before starting Milestone 4.

### Done Recently

- Added direct regression tests for `runBuild` and `runLint`.
- Added smoke coverage for generated multi-type exports.
- Enforced a minimum coverage floor in `packages/core`.
- Cleaned up repo naming around `contenz` and `@contenz/*`.
- Added source-pattern discovery with `sources`.
- Implemented `contenz init` for existing-project scaffolding.
- Added structured diagnostics and formatter outputs for `pretty`, `json`, and `github`.

### Active

- Manifest storage and changed-input diffing
- `build --force`
- `build --dry-run`
- `lint --dry-run`
- `contenz watch`
- minimal `contenz status`

## Next Up

- richer i18n config and fallback behavior design
- translation coverage policy and stale-translation detection design

## After That

- implement Milestone 3 once Milestone 2 incremental foundations are stable

## Documentation Pass After Milestone 3

Before starting the consumption layer, document the stabilized pre-`v0.2` API surface:

- config reference for `contenz.config.*`
- source discovery and collection naming rules
- schema module contract and shared-schema guidance
- multi-type collection behavior and current constraints
- current i18n behavior, compatibility rules, and coverage semantics
- CLI reference for `init`, `lint`, and `build`
- programmatic API reference for `runLint`, `runBuild`, and config loading

## Later

- query API baseline
- first practical Next.js integration
- extensibility MVP for hooks, transforms, and plugins

## Deferred Product Wedge

After the core maturity milestones, the next broader product wedges are:

- a git-backed authoring studio for writer/developer collaboration
- `npm create contenz@latest` via `create-contenz` for standalone docs/helpdesk site starters, separate from the persistent CLI
- `contenz init` in the persistent CLI for adding contenz to an existing project

These stay out of the active backlog until the shared pipeline, diagnostics, incremental workflows, and i18n model are more mature. Site scaffolding is a future starter flow, not a `publish` feature.

## Working Rules

- every backlog item should map cleanly to one or a few PRs
- new CLI behavior should be covered by `packages/e2e`
- shared pipeline logic belongs in `packages/core`
- keep the backlog near-term; move broad future scope back to `ROADMAP.md`
