# Architecture

This document describes the Contenz monorepo layout, packages, and how the content pipeline works.

## Monorepo layout

```
contenz/
├── packages/
│   ├── core/       # @contenz/core – schema helpers, types, build/lint/status API
│   ├── cli/        # @contenz/cli – contenz binary and commands
│   ├── studio/     # @contenz/studio – Next.js authoring app (used by `contenz studio`)
│   └── e2e/        # E2E tests and fixtures (private, not published)
├── docs/           # This documentation set
├── contenz.config.ts
├── PROJECT_SCOPE.md
├── ROADMAP.md
└── BACKLOG.md
```

## Packages

### @contenz/core

- **Role**: Core library. No CLI binary; used by the CLI, Studio, and by your schema/config files.
- **Exports**:
  - Main entry: schema helpers (`defineCollection`, `defineMultiTypeCollection`), config types, format adapters, schema introspection.
  - API entry `@contenz/core/api`: config loading, discovery, parsing, validation, `runBuild`, `runLint`, `runStatus`, content operations (`runList`, `runView`, `runCreate`, `runUpdate`, `runSearch`, `runSchema`), workspace, diagnostics.
- **Owns**: Config and schema contracts, source discovery, content parsing, validation, manifest-backed incremental build, typed output generation, schema introspection, symmetric content I/O.

### @contenz/cli

- **Role**: Provides the `contenz` command.
- **Commands**: `init`, `lint`, `build`, `watch`, `status`, `studio`, `view`, `list`, `create`, `update`, `search`, `schema`.
- **Depends on**: `@contenz/core` for all content and config logic; `@contenz/studio` for the `studio` command (runs the Studio Next.js app with `CONTENZ_PROJECT_ROOT` set).

### @contenz/studio

- **Role**: Web-based authoring UI over repo-backed content. Not published to npm as a standalone app; it is bundled and run via `contenz studio`.
- **Stack**: Next.js 16, React 19, Tailwind CSS v4, shadcn/ui (Base UI), MDXEditor for body editing.
- **Behavior**: Reads `CONTENZ_PROJECT_ROOT` to discover collections and documents; serves API routes for project config, documents, search, file tree; writes content back to the repo via the documents API.

### packages/e2e

- **Role**: End-to-end tests and fixtures. Not published.
- **Fixtures**: `minimal`, `mixed-sources`, `i18n`, `multi-type` – used to drive CLI and pipeline tests.

## Data flow

1. **Config**
   `contenz.config.ts` (and optional `content/<collection>/config.ts`) is loaded and resolved by `@contenz/core`. Defines sources, i18n, output dir, extensions, ignore patterns.

2. **Discovery**
   `discoverCollections(cwd, sources)` walks the filesystem and returns collection roots and their paths. Collection identity comes from folder names under the source pattern (e.g. `content/*` → `content/faq` → collection `faq`).

3. **Schema**
   Each collection can have a `schema.ts` (and optional `config.ts`). The schema module exports `meta` (or `termMeta`/`topicMeta` for multi-type), and optionally `relations`. Config can override types, slug pattern, i18n, extensions, ignore.

4. **Lint**
   `runLint({ cwd, ... })` parses all content files, validates metadata against the schema, runs relation checks, and (optionally) writes a coverage report. Emits diagnostics in pretty, JSON, or GitHub format.

5. **Build**
   `runBuild({ cwd, ... })` uses a manifest (`.contenz/build-manifest.json`) to skip unchanged collections. For each collection it parses content, validates, and writes typed output (e.g. `generated/content/faq.ts`). Manifest is updated after a successful build.

6. **Status**
   `runStatus({ cwd })` compares current input hashes to the manifest and reports whether a build is up to date or which collections would be rebuilt.

7. **AI-native layer**
   The bidirectional content operations (`runView`, `runList`, `runCreate`, `runUpdate`, `runSearch`, `runSchema`) form the AI-native interface. They use the same workspace and parsing primitives as lint/build but expose content through a structured JSON contract. This enables AI agents, scripts, and the Studio to safely introspect schemas, read content, create new items, and update existing items without touching raw files directly.

8. **Studio**
   The Studio app calls the same config and discovery APIs (via Next.js API routes) to list collections and documents, then uses the documents API to read/write content. Saves go back to the repo as file writes.

## Key invariants

- **Repo as source of truth**: Content and config live in the repo; generated files and manifest are derived.
- **Schema-first**: Validation and generated types come from Zod schemas defined in the repo.
- **Incremental by default**: Build skips collections whose input hash matches the manifest and output exists.
- **i18n in the model**: Locale comes from filenames when i18n is enabled; fallback and coverage are part of the resolved config.
- **Symmetric I/O**: The same content can be read, created, and updated through the CLI or programmatic API.
- **AI-friendly JSON contract**: All AI-native commands return `{ success, data, error?, diagnostics? }`.

For configuration details see [Configuration](./CONFIGURATION.md). For the content model and generated output see [Content model](./CONTENT-MODEL.md).
