# contenz Backlog

This backlog is the short-horizon execution queue. It should stay actionable and readable. Large speculative scope belongs in `PROJECT_SCOPE.md`; milestone sequencing belongs in `ROADMAP.md`.

## Current Focus

Milestones 1–3 are complete. Current focus is the Documentation Gate: Core API Stabilization, then Milestone 4 (Consumption Layer).

Near-term boundary: documentation pass after Milestone 3, then start Milestone 4.

### Done Recently

- Milestone 2: manifest-backed incremental build, build --force, build --dry-run, lint --dry-run, contenz watch, contenz status.
- Milestone 3: richer i18n config (I18nConfigShape), locale fallback rules, coverage thresholds and stale translation detection, optional _fallback metadata in generated output; i18n: true remains backward-compatible.
- E2E coverage for dry-run, force, status, and i18n backward compat.

### Active

- Documentation Gate: root docs, @contenz/core API reference, source discovery and i18n semantics documented

## Next Up

- Documentation pass: config reference, source discovery, collection naming, i18n semantics, CLI reference

## After That

- Milestone 4: query API baseline, relation joins, first Next.js integration

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
