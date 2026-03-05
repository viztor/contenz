# contenz Project Scope

This document defines the stable product scope for contenz. It should describe what the project is for, which users it serves, what the main deliverables are, and what the current development target is.

## Product Thesis

contenz should not stop at being a CLI that reads files and emits typed data. The larger opportunity is to become a content system that works for both developers and non-technical editors.

The core idea is:

- developers get a schema-first, type-safe content pipeline that fits real application builds
- editors get a beautiful, deployable authoring interface that hides git, folder structure, and raw metadata
- internationalization is built into the model, not bolted on later

In that model, files, folders, and commits remain valid implementation details, but they are not the primary user experience for most content authors.

## Who The Product Is For

contenz should serve three user groups at once:

### Developers

- define schemas
- validate content in CI and local workflows
- generate typed outputs for apps
- integrate content into build pipelines and runtime query APIs

### Editors And Marketers

- create and update content without touching git or frontmatter
- see validation feedback in human language
- work through guided fields rather than raw metadata
- preview changes before publish

### Localization Teams

- manage locale-specific content side by side
- understand translation coverage and staleness
- work with fallback behavior explicitly, not implicitly
- review translation completeness at field, entry, and locale levels

## Product Modes

contenz should evolve into a product with three complementary modes:

### 1. Developer Pipeline

The current foundation:

- schema helpers
- config loading
- lint/build commands
- typed output generation
- validation and diagnostics
- framework integrations

### 2. Authoring Studio

A browser-based interface that can be launched locally or deployed for teams. The studio should allow users to write and manage content directly without needing to understand repository structure.

The studio should eventually provide:

- schema-driven content forms
- rich body editing
- relation pickers instead of manual slug references
- locale-aware editing views
- draft and review states
- preview and publish flows
- validation messages mapped to real fields and content blocks

### 3. Content Service Layer

A layer that makes content available to applications and tools:

- query API
- integration packages
- preview access
- publishing hooks
- future API surfaces for UI-based authoring and sync

## Internationalization As A First-Class Citizen

Internationalization should be a defining property of contenz, not a secondary feature.

That means i18n must influence:

- schema and config design
- generated output shape
- querying and fallback semantics
- validation and diagnostics
- authoring workflows
- publishing and review workflows

A first-class i18n experience should eventually include:

- locale-aware content identity
- explicit fallback chains
- translation completeness tracking
- stale translation detection
- field-level missing-translation visibility
- side-by-side locale editing
- translation handoff and review workflows
- locale-aware preview and publishing

The product should feel like it was designed for multilingual teams from the start.

## Authoring Experience Vision

The long-term product should make authors feel like they are using a modern content application, not editing implementation files.

Important qualities:

- beautiful, intentional UI rather than a generic admin console
- low-friction authoring with autosave and clear validation
- forms generated from schema, with good labels and helpful constraints
- metadata represented as normal fields and controls
- body editing that works for structured and long-form content
- relation selection through search, browse, and visual context
- live or near-live preview
- draft, review, and publish states
- deployable for a team, not only a local dev tool

The key product principle here is:

Git should remain optional for authors even if it remains valuable for developers.

## Current Baseline

The repo already provides a meaningful technical foundation:

- `@contenz/core` for schema helpers and programmatic build/lint APIs
- `@contenz/cli` for the `contenz` command
- Markdown and MDX parsing
- typed content generation
- relation validation
- multi-type collection support
- filename-based locale grouping
- unit and e2e test coverage for the current command surface

This is enough to justify building forward, but not enough yet to claim the larger product vision.

## Main Deliverables

The project should deliver these major outcomes over time:

1. A reliable schema-first content pipeline for developers.
2. A strong diagnostics and validation system that is understandable by humans and machines.
3. A truly internationalized content model with fallback, coverage, and workflow support.
4. A consumption layer for apps, especially query helpers and framework integrations.
5. A deployable authoring studio for non-technical content teams.
6. An extensibility model for hooks, transforms, plugins, and future adapters.

## Current Development Target

The current development target remains a practical `v0.2` focused on core maturity.

`v0.2` should prove that the foundation is strong enough to support the broader product:

- shared build/lint pipeline internals
- structured diagnostics
- incremental build support
- watch mode
- dry-run support
- minimal status support
- improved i18n behavior around fallback and coverage policy
- a clearly stronger quality baseline than the current starting point

This matters because the future UI and workflow layers will only be credible if the core model is stable.

## Architectural Direction

To support the long-term vision, contenz should trend toward this shape:

- core as the canonical content model and validation engine
- CLI as the developer-facing operational surface
- integrations as thin adapters
- studio as a higher-level authoring surface built on the same schema and content model
- storage abstractions that allow file-backed workflows first, with room for richer backends later

The right mental model is:

contenz is a content platform with a file-backed first implementation, not merely a file parser.

## Product Principles

- Schema-first: schemas remain the source of truth.
- i18n-first: multilingual teams should feel native, not second-class.
- Git-optional for authors: implementation details should not define the editorial UX.
- Framework-adaptive: the core stays portable; integrations stay thin.
- Type-safe end to end: developers should trust the generated and queried shapes.
- Editor-grade UX: the UI vision should be deliberate, not an afterthought.
- Incremental by default: normal edit loops should be fast.
- Extensible by composition: hooks and transforms should be easier than forks.

## Non-Goals For The Current Phase

These should not displace the current foundation work:

- building a full hosted CMS before the core contracts are stable
- broad framework adapter coverage before one integration path is solid
- premature remote-source abstraction before the local model is proven
- worker-thread complexity before profiling justifies it
- visualization features before the data and workflow model are mature

## Canonical Planning Docs

- [ROADMAP.md](/Users/viz/dev/contenz/ROADMAP.md) for milestone sequencing
- [BACKLOG.md](/Users/viz/dev/contenz/BACKLOG.md) for near-term executable work

Working drafts and generated planning material should stay outside the canonical repo docs.
