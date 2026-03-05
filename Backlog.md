# contenz Backlog

This backlog is the short-horizon execution queue. It should stay actionable and readable. Large speculative scope belongs in `PROJECT_SCOPE.md`; milestone sequencing belongs in `ROADMAP.md`.

## Current Focus

Current focus is Milestone 1: shared pipeline internals and structured diagnostics.

### Active

- Extract shared discovery logic from `runBuild` and `runLint`.
- Introduce shared file-level processing for parse, validation, and relation extraction.
- Introduce shared collection-level processing for traversal and aggregation.
- Define a stable diagnostics shape with category, severity, code, file, and message.
- Add formatter support for `pretty`, `json`, and `github`.

### Done Recently

- Added direct regression tests for `runBuild` and `runLint`.
- Added smoke coverage for generated multi-type exports.
- Enforced a minimum coverage floor in `packages/core`.
- Cleaned up repo naming around `contenz` and `@contenz/*`.

## Next Up

- Manifest storage and changed-input diffing
- `build --force`
- `build --dry-run`
- `lint --dry-run`
- `contenz watch`
- minimal `contenz status`

## After That

- richer i18n config and fallback behavior
- translation coverage policy and stale-translation detection
- query API baseline
- first practical Next.js integration
- extensibility MVP for hooks, transforms, and plugins

## Working Rules

- every backlog item should map cleanly to one or a few PRs
- new CLI behavior should be covered by `packages/e2e`
- shared pipeline logic belongs in `packages/core`
- keep the backlog near-term; move broad future scope back to `ROADMAP.md`
