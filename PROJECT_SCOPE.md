# contenz Project Scope

This document defines the stable product scope for contenz. It should answer what contenz is, who it serves, what it is trying to deliver, and what the current development target is.

## What contenz Is

contenz is a schema-first, git-backed content collaboration platform for application teams.

It is for teams that want:

- repository-backed content as the canonical source of truth
- typed developer workflows around schemas, validation, and generated outputs
- a better writing and review experience for non-developers
- strong multilingual workflows without adopting a CMS as the system of record

## What contenz Is Not

contenz is not:

- a dynamic CMS
- a database-first content platform
- a replacement for repository-backed content with a proprietary storage model
- a product that requires writers to understand git, folder structures, or raw frontmatter

The intended model is to keep content in the repo while giving writers and localization teams a much better interface for working with it.

## Product Thesis

Most documentation, helpdesk, support, and structured editorial content does not change often enough to justify a CMS as the canonical source of truth. But the raw file-and-git workflow is still too developer-centric for most writers.

The opportunity for contenz is to close that gap:

- developers keep a schema-first, file-backed workflow
- writers get a deployable, beautiful authoring experience
- teams collaborate through reviewable changes instead of dynamic content mutation
- internationalization is native to the model from the start

The core bet is that many teams should be able to stay in git without forcing writers to work like developers.

## Source Of Truth And Collaboration Model

The repository is the canonical source of truth.

That means:

- content, schemas, and config live in the repo
- generated outputs are derived artifacts, not the source of truth
- the studio operates on repo-backed content, not a separate database-first store
- writers interact through a higher-level UI, not raw files
- the default editorial workflow is branch + PR
- git remains visible to developers and optional for writers

The studio should help create reviewable changesets, but it should not redefine the storage model.

## Who The Product Is For

contenz should serve three user groups at once:

### Developers

- define schemas
- validate content in CI and local workflows
- generate typed outputs for apps
- integrate content into build pipelines and runtime query APIs

### Writers And Content Teams

- create and update content without touching git or raw metadata
- work through guided fields instead of implementation details
- preview changes before review and merge
- collaborate with developers without moving the source of truth out of the repo

### Localization Teams

- manage locale-specific content side by side
- understand translation coverage and staleness
- review locale completeness and fallback behavior explicitly
- work through locale-aware editing and review flows

## Product Surfaces

contenz should evolve into four complementary product surfaces.

### 1. Core Model And Pipeline

The current technical foundation:

- schema helpers
- config loading
- lint/build commands
- typed output generation
- diagnostics and validation
- framework-facing integration primitives

### 2. Runtime And Integrations

The layer that makes content usable inside apps and tooling:

- query APIs
- framework integrations
- preview and delivery hooks
- future application-facing integration surfaces

### 3. Authoring Studio

A deployable authoring interface over repo-backed content.

The studio should be:

- schema-driven
- locale-aware
- validation-aware
- review-oriented
- built for writer/developer collaboration, not CMS-style dynamic content management

The studio should eventually provide:

- forms instead of raw metadata editing
- relation pickers instead of manual slug entry
- rich body editing
- preview
- draft and review states
- PR-oriented collaboration
- validation messages mapped to real fields and content blocks

### 4. Site Starters

A future product surface for generating opinionated websites that run on contenz.

The first target should be:

- docs/helpdesk sites
- generated as standalone Next.js starters
- offered through curated theme presets

This is a future product track, not part of the current `v0.2` target.

## AI Assistance

AI should be part of the authoring experience, but in an assistive role.

AI should help with:

- drafting and rewriting
- summarizing and restructuring
- translation assistance
- metadata suggestions
- relation suggestions
- preparing review-ready changes

AI should not:

- bypass schema validation
- become the source of truth
- publish or merge changes without human approval

The intended model is human-reviewed, AI-assisted authorship.

## Internationalization As A First-Class Citizen

Internationalization should be a core structural concern, not a feature bucket.

That means i18n should shape:

- content identity across locales
- config and schema design
- generated output shape
- fallback behavior
- validation and diagnostics
- translation completeness and staleness reporting
- locale-aware preview and review workflows

Localization teams should feel like a primary audience of the product, not an edge case.

## Future Command Semantics

Future high-level product entry points should be intentionally split:

### `npm create contenz@latest`

Creates a new standalone website starter through a one-shot scaffolder, not the persistent project CLI.

The underlying package should be `create-contenz`.

First version should:

- target docs/helpdesk sites first
- use Next.js as the first generated framework target
- offer curated themes
- include contenz already configured
- include starter content and schema examples
- avoid adding a long-lived scaffolding dependency to the generated project

### `contenz init`

Adds contenz into an existing project through the ongoing project CLI.

First version should:

- create `contenz.config.*`
- scaffold `content/`
- add starter schemas and sample content
- add generated-output guidance or starter wiring hints
- avoid patching host app routes, layouts, or pages automatically

This split is deliberate:

- `npm create contenz@latest` is for one-time project creation
- `contenz init` is for adopting contenz inside an existing repo
- `contenz build`, `contenz lint`, `contenz watch`, and future project commands belong to the persistent CLI surface

These commands should not be framed as `publish`.

`publish` belongs to editorial workflow semantics, not website scaffolding.

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

This is enough to justify building forward, but not enough yet to claim the broader workflow and authoring product vision as delivered.

## Main Deliverables

The project should deliver these major outcomes over time:

1. A reliable schema-first content pipeline for developers.
2. A strong diagnostics and validation system that is understandable by humans and machines.
3. A truly internationalized content model with fallback, coverage, and workflow support.
4. A runtime and integration layer for apps.
5. A deployable authoring studio for writers and localization teams.
6. Opinionated site starters for teams that want a one-command documentation/helpdesk website.
7. An extensibility model for hooks, transforms, plugins, and future adapters.

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

This matters because the future studio and starter-site surfaces will only be credible if the core data model and workflow semantics are stable.

## Product Principles

- Schema-first: schemas remain the source of truth for structure and validation.
- Repo-first: the repository remains the canonical content source.
- Git-optional for writers: implementation details should not define the editorial UX.
- i18n-first: multilingual teams should feel native, not second-class.
- Type-safe end to end: developers should trust generated and queried shapes.
- Reviewable collaboration: branch + PR is the default workflow model.
- Editor-grade UX: the studio should feel intentional, not like an internal admin tool.
- Incremental by default: normal edit loops should be fast.
- Extensible by composition: hooks and transforms should be easier than forks.

## Non-Goals For The Current Phase

These should not displace the current foundation work:

- building a full CMS
- moving the canonical content model into a database-first system
- broad framework adapter coverage before one path is solid
- automatic app mutation in `contenz init`
- deployment orchestration as the first interpretation of website generation
- worker-thread complexity before profiling justifies it

## Canonical Planning Docs

- [ROADMAP.md](/Users/viz/dev/contenz/ROADMAP.md) for milestone sequencing
- [BACKLOG.md](/Users/viz/dev/contenz/BACKLOG.md) for near-term executable work

Working drafts and generated planning material should stay outside the canonical repo docs.
