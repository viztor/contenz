# contenz Roadmap

This roadmap is the milestone-level delivery plan. It should stay readable, dependency-ordered, and stable enough to guide work across multiple PRs.

## Current Status

- Baseline workspace split is done: `@contenz/core`, `@contenz/cli`, `@contenz/e2e`
- Current command surface is `lint` and `build`
- Core validation, generation, i18n filename grouping, and relation checks are working
- Baseline hardening is complete and now treated as finished foundation work
- The roadmap below starts with the next active delivery milestone

## Milestone 1: Shared Pipeline Core And Diagnostics

Status: complete

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

Outcome:

- shared source discovery and config normalization are in place
- `contenz init` exists for existing-project scaffolding
- build and lint emit structured diagnostics with `pretty`, `json`, and `github` output formats
- regression coverage includes programmatic and CLI formatter behavior

## Milestone 2: Incremental Build And Watch

Status: next active milestone

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

## Documentation Gate: Core API Stabilization

This is the documentation pass that should happen immediately after Milestone 3, before broader surface expansion.

Goal:

Freeze and document the pre-`v0.2` core API surface so the project has a clear, trustworthy contract for config, schema authoring, source discovery, CLI usage, and i18n behavior.

Deliverables:

- root docs updated for the current product and CLI model
- `@contenz/core` docs updated for schema helpers, config contracts, and programmatic APIs
- explicit reference material for:
  - source discovery semantics
  - collection identity and naming rules
  - collection-local config behavior
  - multi-type collection rules
  - current i18n semantics and compatibility rules
- clear marking of stable vs deprecated surface areas

Exit criteria:

- a user can set up, configure, lint, build, and understand contenz without reading source code
- config and discovery invariants are documented in one place, not spread across examples only
- the documented surface matches the behavior covered by tests

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

Provide a deployable, git-backed authoring interface so content teams can work directly in contenz without dealing with raw files, frontmatter, or day-to-day git mechanics.

Expected capabilities:

- schema-driven editing UI
- locale-aware authoring and review
- relation pickers and guided field editing
- draft and review states
- preview
- AI assistance for drafting, rewriting, and translation
- branch + PR oriented collaboration
- translation coverage and staleness visibility

Prerequisite:

The core data model, diagnostics, and i18n semantics must be stable first. The studio should be built on top of those primitives, not in parallel with an unstable foundation.

## Future Product Track: Site Starters

This is also outside the current `v0.2` scope.

Goal:

Provide one-shot starter generation for teams that want a repo-backed website built around contenz from day one.

First target:

- `npm create contenz@latest`
- powered by a dedicated `create-contenz` scaffolder
- kept separate from the persistent `contenz` project CLI
- standalone docs/helpdesk starter
- Next.js first
- curated theme presets

Related future command:

- `contenz init` in the persistent project CLI for scaffolding contenz into an existing project without automatically patching host app routes or layouts in v1

Boundary:

- this track is about starter scaffolding, not publish semantics
- `publish` should remain reserved for editorial workflow and promotion concepts

Prerequisite:

The pipeline, config model, and integration story need to be stable first. Site starters should package a mature workflow, not invent one early.

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
- a documentation pass that freezes and explains the core API surface
- a stronger quality baseline than the current `v0.1` starting point
