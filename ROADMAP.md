# contenz Roadmap

This roadmap is the milestone-level delivery plan. It should stay readable, dependency-ordered, and stable enough to guide work across multiple PRs.

## Current Status

- Baseline workspace split is done: `@contenz/core`, `@contenz/cli`, `@contenz/e2e`
- Current command surface is `lint` and `build`
- Core validation, generation, i18n filename grouping, and relation checks are working
- Sprint 0 hardening is largely complete: regression tests and a minimum coverage floor are in place

## Milestone 0: Baseline Hardening

Status: substantially complete

Delivered:

- consistent `contenz` naming across the main package surface
- direct regression tests for `runBuild` and `runLint`
- smoke coverage for generated multi-type exports
- enforced core coverage floor

Exit criteria:

- `npm run build`, `npm run test`, `npm run typecheck`, and `npm run lint` all pass
- core hot paths have direct regression coverage

## Milestone 1: Shared Pipeline Core And Diagnostics

Status: next active milestone

Goal:

Reduce duplicated build/lint orchestration and establish a stable diagnostics model before adding more command surface.

Deliverables:

- shared discovery logic for config, schema, and content traversal
- shared file and collection processing modules
- structured diagnostics with stable categories and codes
- formatter outputs for `pretty`, `json`, and `github`

Exit criteria:

- build and lint share internal pipeline modules
- no regression in current e2e fixtures
- machine-readable diagnostics are covered by tests

## Milestone 2: Incremental Build And Watch

Goal:

Make the normal content-edit loop fast enough for daily use.

Deliverables:

- manifest-backed incremental build engine
- `build --force`
- `build --dry-run`
- `lint --dry-run`
- `contenz watch`
- minimal `contenz status`

Exit criteria:

- unchanged collections can be skipped safely
- single-file edits only rebuild impacted outputs
- watch mode is stable on normal fixture projects

## Milestone 3: i18n v2 Core

Goal:

Move i18n from filename grouping into a broader runtime model.

Deliverables:

- richer i18n config shape
- locale fallback rules
- coverage thresholds and stale translation detection
- optional fallback metadata in generated output

Exit criteria:

- `i18n: true` remains backward-compatible
- fallback behavior and translation coverage policy are verified in e2e coverage

## Milestone 4: Consumption Layer

Goal:

Make generated content easier to consume in real application code.

Deliverables:

- query API baseline for filtering, slug access, sorting, and pagination
- basic relation joins
- first practical Next.js integration

Exit criteria:

- query helpers are type-safe against generated output
- integration coverage exists for a sample Next-oriented fixture

## Milestone 5: Extensibility MVP

Goal:

Establish stable extension hooks before adding broader ecosystem breadth.

Deliverables:

- lifecycle hooks
- transform pipeline
- validation plugin API
- computed fields
- optional body extraction

Exit criteria:

- hooks and plugins are covered by integration tests
- at least one built-in transform and one built-in validation extension exist

## Future Product Track: Authoring Studio

This is not the current milestone focus, but it is part of the intended product scope.

Goal:

Provide a deployable, editor-facing interface so content teams can work directly in contenz without dealing with raw git workflows, folder conventions, or manual metadata editing.

Expected capabilities:

- schema-driven editing UI
- locale-aware authoring and review
- relation pickers and guided field editing
- preview and publish flows
- draft and workflow states
- translation coverage and staleness visibility

Prerequisite:

The core data model, diagnostics, and i18n semantics must be stable first. The studio should be built on top of those primitives, not in parallel with an unstable foundation.

## Deferred Until After Milestone 5

- remote content adapters
- migration tooling
- asset pipeline breadth
- framework adapters beyond the first practical target
- graph visualization
- worker-thread parsing unless profiling proves the need

## Release Target

The intended `v0.2` release should include:

- shared pipeline internals
- diagnostics formats
- incremental build support
- watch mode
- dry-run support
- basic status support
- improved i18n behavior
- a stronger quality baseline than the current `v0.1` starting point
