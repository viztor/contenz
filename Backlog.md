# contenz Execution Backlog

Date: 2026-03-06
Source: `Roadmap.optimized.md`

This backlog translates the roadmap into dependency-ordered, issue-sized work. Each item is intentionally small enough to track as a PR or short task batch.

## Sprint 0: Baseline Hardening

### B0.1 Test `runBuild` success path

- Scope: add unit or integration coverage for a valid single-collection build in `packages/core`.
- Files: `packages/core/src/run-build.ts`, `packages/core/src/*.test.ts`
- Done when:
  - test asserts generated collection file content
  - test asserts generated index file exports
  - test runs without fixture-specific manual setup outside the repo

### B0.2 Test `runBuild` failure path

- Scope: cover invalid content/schema failures and exit behavior for the programmatic API surface.
- Done when:
  - test asserts error propagation structure
  - test asserts no partial output is treated as success

### B0.3 Test `runLint` happy path and coverage mode

- Scope: add focused tests for lint summary output and translation coverage behavior.
- Done when:
  - lint result shape is asserted
  - `--coverage` or equivalent API path is exercised by tests

### B0.4 Smoke-test multi-type generated exports

- Scope: add regression coverage for multi-type collection output shape and export wiring.
- Done when:
  - generated output includes all configured type buckets
  - index exports remain stable

### B0.5 Add coverage ratchet to core

- Scope: fail CI if `packages/core` drops below the agreed baseline.
- Done when:
  - coverage threshold is encoded in test config
  - repo docs mention the active floor

## Sprint 1: Shared Pipeline Core

### B1.1 Introduce discovery module

- Scope: extract config, schema, and content-file discovery into `packages/core/src/pipeline/discovery.ts`.
- Done when:
  - `runBuild` and `runLint` both consume the new discovery path
  - no behavior change in e2e fixtures

### B1.2 Introduce file processing module

- Scope: isolate parse + validate + relation extraction into `packages/core/src/pipeline/process-file.ts`.
- Done when:
  - existing parser/validator behavior is preserved
  - file-level errors are returned as structured data, not ad hoc strings

### B1.3 Introduce collection processing module

- Scope: centralize collection traversal and aggregation in `packages/core/src/pipeline/process-collection.ts`.
- Done when:
  - build/lint orchestration no longer duplicate collection loops
  - shared result types are exported internally

### B1.4 Define diagnostics model

- Scope: create a stable diagnostics shape with `code`, `category`, `severity`, `location`, and `message`.
- Done when:
  - config, parse, schema, relation, and internal errors map to codes
  - existing human-readable output is generated from the model

### B1.5 Add diagnostics formatters

- Scope: support `pretty`, `json`, and `github` formatting in CLI output.
- Done when:
  - CLI accepts a format flag
  - e2e fixtures cover `json` and `github`

## Sprint 2: Incremental Build Foundation

### B2.1 Implement manifest schema and storage

- Scope: add `packages/core/src/manifest.ts` with load/save/types for `.contenz/manifest.json`.
- Done when:
  - missing manifest is handled cleanly
  - manifest writes are deterministic

### B2.2 Hash project inputs

- Scope: compute hashes for content files, schema files, and project config.
- Done when:
  - changed vs unchanged files can be diffed
  - schema/config changes invalidate expected scopes

### B2.3 Wire manifest diff into `runBuild`

- Scope: skip unchanged collections and report skip counts.
- Done when:
  - unchanged projects report skipped collections
  - `--force` bypasses manifest optimization

### B2.4 Add build dry-run

- Scope: preview intended work without writing output files.
- Done when:
  - changed collections/files are reported
  - no generated files are written in dry-run mode

## Sprint 3: Watch and Status

### B3.1 Implement watch runner

- Scope: add `packages/core/src/run-watch.ts` using the shared pipeline and manifest cache.
- Done when:
  - content edits reprocess only the impacted collection
  - schema edits trigger collection-wide revalidation

### B3.2 Expose `contenz watch`

- Scope: add CLI command wiring in `packages/cli`.
- Done when:
  - watch supports debounce and optional clear-screen behavior
  - command exits cleanly on interrupt

### B3.3 Add lint dry-run

- Scope: support preview-only lint execution for CI and local inspection.
- Done when:
  - lint dry-run returns diagnostics without side effects

### B3.4 Add minimal status command

- Scope: report manifest freshness, collection counts, and last lint/build summary.
- Done when:
  - status runs without requiring a rebuild
  - status output is stable enough for docs/examples

## Sprint 4: i18n v2 Core

### B4.1 Expand i18n config model

- Scope: replace boolean-only semantics with `true | false | { locales, defaultLocale, fallback, coverage }`.
- Done when:
  - `i18n: true` remains backward-compatible
  - typed config inference still works

### B4.2 Implement fallback resolver

- Scope: add locale fallback resolution logic in a dedicated module.
- Done when:
  - fallback chains are deterministic
  - missing locales surface explicit diagnostics

### B4.3 Add coverage thresholds and stale translation detection

- Scope: support policy-driven warnings/errors and mtime-based staleness checks.
- Done when:
  - e2e fixture covers threshold failures
  - stale translations are visible in diagnostics

## Sprint 5: Consumption Layer

### B5.1 Ship query API baseline

- Scope: add a runtime query layer with `locale`, `slug`, `where`, `sortBy`, `slugs`, and `paginate`.
- Done when:
  - API is type-safe against generated entry shapes
  - locale-aware reads use fallback rules correctly

### B5.2 Add basic relation joins

- Scope: allow query-time resolution of simple cross-collection relations.
- Done when:
  - joins preserve type safety
  - unresolved relations fail predictably

### B5.3 Add Next.js integration MVP

- Scope: wire build/watch into a minimal Next-oriented integration surface.
- Done when:
  - sample fixture covers build and dev workflows
  - integration contract is documented

## Sprint 6: Extensibility MVP

### B6.1 Implement lifecycle hooks

- Scope: add `beforeParse`, `afterParse`, `afterValidate`, `afterGenerate`, and `done`.
- Done when:
  - hooks support sync/async execution
  - hook failures surface as structured diagnostics

### B6.2 Add transform pipeline

- Scope: support configurable content transforms before generation.
- Done when:
  - transform ordering is explicit
  - transformed output remains type-safe

### B6.3 Add validation plugin API

- Scope: allow external validators to participate in lint/build.
- Done when:
  - at least one built-in plugin exists
  - plugin diagnostics use the shared model

### B6.4 Add computed fields and optional body extraction

- Scope: support derived fields and `includeBody` modes without breaking existing output.
- Done when:
  - computed fields are schema-typed
  - raw/html body output is opt-in

## Cross-cutting Rules

- Every backlog item must ship with tests in the package it changes.
- New CLI flags require e2e coverage in `packages/e2e`.
- Shared internals go in `packages/core` unless there is a strong packaging reason otherwise.
- Defer remote sources, asset pipelines, migration tooling, and non-Next adapters until Sprint 6 is complete.

## Suggested PR Grouping

- PR 1: `B0.1` to `B0.5`
- PR 2: `B1.1` to `B1.3`
- PR 3: `B1.4` to `B1.5`
- PR 4: `B2.1` to `B2.4`
- PR 5: `B3.1` to `B3.4`
- PR 6: `B4.1` to `B4.3`
- PR 7: `B5.1` to `B5.3`
- PR 8: `B6.1` to `B6.4`

