# Contenz Codebase Reference

> **Purpose**: Developer reference for maintainers and AI agents working on the contenz monorepo. Contains architecture overview, module map, known issues, and actionable cleanup items.

---

## Monorepo Structure

```
contenz/
├── packages/
│   ├── core/          # @contenz/core — schema validation, codegen, workspace, introspection
│   ├── cli/           # @contenz/cli — Stricli CLI (12 commands + bash completion)
│   ├── client/        # @contenz/client — runtime createContent / createT / query
│   ├── adapter-mdx/   # @contenz/adapter-mdx — MD/MDX format adapter (peer dep on core)
│   └── e2e/           # @contenz/e2e — integration tests + fixtures
├── docs/              # Project documentation
├── skills/            # Agent skill for contenz workflows
├── turbo.json         # Turborepo task config
├── oxlint.config.ts   # Root type-aware oxlint (Ultracite)
├── oxfmt.config.ts    # Root oxfmt
└── package.json       # Workspace root (pnpm workspaces)
```

### Package Dependency Graph

```
adapter-mdx ──peer──▸ core
cli ──────────dep───▸ core, @stricli/core, @stricli/auto-complete
client ─────── (no runtime dep on core)
e2e ──────────dev───▸ core, cli, adapter-mdx
```

Internal monorepo deps use `workspace:*`. Engines: **Node.js LTS ≥ 24**.

### Build Tooling

| Tool       | Version | Purpose                                       |
| ---------- | ------- | --------------------------------------------- |
| TypeScript | 7.x     | Type checking + declaration emit              |
| tsup       | 8.x     | JS bundling (core, cli, client, adapter-mdx)  |
| Vitest     | 4.x     | Testing (core, client, cli, adapter-mdx, e2e) |
| oxlint     | 1.x     | Type-aware lint (Ultracite presets)           |
| oxfmt      | 0.x     | Formatting                                    |
| Turbo      | 2.x     | Task orchestration                            |
| pnpm       | 11.x    | Package manager                               |
| Zod        | 4.x     | Schema validation runtime                     |
| Stricli    | 1.x     | CLI framework                                 |
| Husky      | 9.x     | Git hooks                                     |

---

## @contenz/core — Module Map

The core package has **two export entry points**:

| Entry | Path | Purpose |
| --- | --- | --- |
| `@contenz/core` | `src/index.ts` | User-facing API: `defineCollection`, types, workspace, content I/O |
| `@contenz/core/api` | `src/api.ts` | Full programmatic API: all pipelines, introspection, search, etc. |

### Source Files

```
src/
├── index.ts              # Public exports (user-facing)
├── api.ts                # Full programmatic exports (CLI/tooling)
│
├── types.ts              # All type definitions (ContenzConfig, SchemaModule, etc.)
├── config.ts             # Config loading, resolution, extractRelations
├── sources.ts            # Collection discovery, glob patterns
├── workspace.ts          # createWorkspace() — canonical config loading path
│
├── format-adapter.ts     # FormatAdapter interface + JSON adapter + registry
├── parser.ts             # File name parsing, content file parsing
├── validator.ts          # Zod schema validation, relation validation, cycle detection
├── introspect.ts         # Zod schema introspection (field types, descriptions)
├── generator.ts          # TypeScript codegen from Zod schemas
├── diagnostics.ts        # Diagnostic types + formatters (pretty, JSON, GitHub)
├── manifest.ts           # Build manifest for incremental rebuilds
├── define-collection.ts  # defineCollection() helper for schema.ts files
│
├── content-io.ts         # CRUD operations (readContent, writeContent, updateContent)
├── run-build.ts          # Build pipeline (content → generated .ts files)
├── run-lint.ts           # Lint pipeline (validate content against schemas)
├── run-status.ts         # Status check (is build up to date?)
├── run-content-ops.ts    # CLI content operations (list, view, create, update)
├── run-search.ts         # Content search across collections
├── run-schema.ts         # Schema introspection command
│
├── test-fixtures.ts      # Test helper: copies e2e fixtures + rewrites imports
├── config.test.ts        # Config tests
├── manifest.test.ts      # Manifest tests
├── parser.test.ts        # Parser tests
├── run-build.test.ts     # Build pipeline tests
├── run-lint.test.ts      # Lint pipeline tests
├── run-status.test.ts    # Status tests
├── validator.test.ts     # Validator tests
└── __tests__/
    └── introspect.test.ts  # Introspection tests
```

### Data Flow

```
contenz.config.ts (user)
        │
        ▼
   loadProjectConfig()
        │
        ▼
   createWorkspace()  ◀── CANONICAL ENTRY POINT
   ┌────┼─────────────┐
   │    │             │
   │  resolveConfig() │  registerAdapters()
   │    │             │
   │  discoverCollections()
   │    │
   │  For each collection:
   │    ├── loadCollectionConfig()
   │    ├── loadSchemaModule()
   │    └── globContentFiles()
   │
   └─── Workspace { collections[], resolvedConfig }
             │
        ┌────┼────┬────────┬──────────┐
        ▼    ▼    ▼        ▼          ▼
    runBuild runLint runStatus  content-io  run-search/schema
```

All pipelines use `createWorkspace()` as the single config-loading path.

---

## @contenz/cli — Command Map

Built with **Stricli** (`app.ts` route map + `buildCommand` per command). Entry: `cli.ts` → `run(app, argv, context)`.

| Command | Source | Core Function |
| --- | --- | --- |
| `init` | `commands/init.ts` | Scaffolds project (standalone) |
| `build` | `commands/build.ts` | `runBuild()` |
| `lint` | `commands/lint.ts` | `runLint()` |
| `status` | `commands/status.ts` | `runStatus()` |
| `watch` | `commands/watch.ts` | `runBuild()` in loop |
| `view` | `commands/view.ts` | `runView()` |
| `list` | `commands/list.ts` | `runList()` |
| `create` | `commands/create.ts` | `runCreate()` |
| `update` | `commands/update.ts` | `runUpdate()` |
| `search` | `commands/search.ts` | `runSearch()` |
| `schema` | `commands/schema.ts` | `runSchema()` |
| `skill` | `commands/skill.ts` | `runSkill()` |
| `install` / `uninstall` | (auto-complete) | bash completion hooks (hidden) |

### CLI Shared Utilities

- `shared.ts` — typed flag specs (`cwd`, formats, variadic `--set`)
- `output.ts` — `printResult` / `fail` (JSON vs pretty; sets `exitCode`)
- `context.ts` — injectable `ContenzContext` for tests + completion
- `bash-complete.ts` — shell completion proposals

---

## @contenz/adapter-mdx

Single file: `src/index.ts` (226 lines). Exports `mdxAdapter: FormatAdapter`.

Handles both `.md` and `.mdx` files:

- **MDX**: `export const meta = { ... }` via brace-balanced scanner
- **MD**: `---` YAML/JSON frontmatter
- Auto-detects format per-file

---

## Configuration Model

```
contenz.config.ts (project root)
  ├── sources: string[]          — glob patterns for collection discovery
  ├── outputDir: string          — generated output directory
  ├── extensions: string[]       — file extensions to scan
  ├── ignore: string[]           — glob patterns to ignore
  ├── i18n: boolean | I18nConfig — locale detection
  ├── strict: boolean            — fail on warnings
  ├── adapters: FormatAdapter[]  — external format adapters
  ├── collections: Record<string, CollectionDeclaration>  — inline collection definitions
  └── coveragePath: string       — coverage report path

content/{collection}/config.ts (collection override)
  ├── types: ContentType[]       — multi-type filename patterns
  ├── slugPattern: RegExp        — custom slug extraction
  ├── i18n, extensions, ignore   — override project defaults

content/{collection}/schema.ts (collection schema)
  ├── meta: ZodSchema            — default schema (single-type)
  ├── {name}Meta: ZodSchema      — named schemas (multi-type)
  ├── relations: Relations       — cross-collection field mappings
  └── types: ContentType[]       — filename routing patterns
```

### Config Resolution Order

`BUILT_IN_DEFAULTS` → `contenz.config.ts` → `{collection}/config.ts`

Inline `collections` definitions in `contenz.config.ts` are merged with filesystem-discovered collections. Inline definitions take precedence for collections with the same name.

Built-in defaults: `extensions: ["md", "mdx", "json"]`, `sources: ["content/*"]`, `outputDir: "generated/content"`

---

## Cleanup Items

Addressed recently:

- Preview package / `contenz preview` removed
- citty → Stricli CLI migration
- pnpm workspaces + `workspace:*` internal deps
- oxlint + oxfmt (Ultracite) quality gates
- Node LTS (`>=24`, tsup `node24`, CI `lts/*`)
- e2e shared `setup.ts` + zod fixture linking under pnpm

Still useful later: `contenz doctor`, publish tarball verify, raise core coverage floor.

---

## Test Architecture

| Package     | Runner | Scope                                                |
| ----------- | ------ | ---------------------------------------------------- |
| core        | Vitest | unit + pipeline (~176 tests)                         |
| client      | Vitest | query / localize / createContent                     |
| cli         | Vitest | Stricli help/version/enum smoke (injectable context) |
| adapter-mdx | Vitest | format adapter                                       |
| e2e         | Vitest | CLI + API fixtures (~183 tests)                      |

### Core Tests

Core tests live alongside source files (`*.test.ts`). They use `test-fixtures.ts` to copy e2e fixture projects to temp dirs.

### E2E Tests

E2E tests live in `packages/e2e/`. They use 6 fixture projects under `packages/e2e/fixtures/`:

| Fixture            | Purpose                                  |
| ------------------ | ---------------------------------------- |
| `minimal`          | Basic single-collection, flat            |
| `centralized`      | Inline collections config (no schema.ts) |
| `i18n`             | Multi-locale collection                  |
| `multi-type`       | Collection with multiple content types   |
| `mixed-sources`    | Multiple source patterns                 |
| `invalid-schema`   | Schema validation error cases            |
| `invalid-relation` | Relation validation error cases          |

E2E tests spawn CLI processes and validate output. They symlink `@contenz/core` and `@contenz/adapter-mdx` into fixture `node_modules/` in `beforeAll`.

---

## Key Design Decisions

1. **Adapter pattern**: Format support is extensible via `FormatAdapter`. JSON is built-in, MD/MDX is external (`@contenz/adapter-mdx`). Users register adapters in `contenz.config.ts`.

2. **Workspace as single entry point**: All pipelines load config via `createWorkspace()`. No manual config loading elsewhere.

3. **Zod 3.25 compatibility**: Internal `_def` access uses `as any` casts. The Zod v4 engine changed `_def.typeName` → `_def.type`, `_def.shape()` → `_def.shape` (plain object), and `_def.description` → `schema.description`.

4. **Incremental builds**: `run-build.ts` uses manifest-based hashing to skip unchanged collections.

5. **Two export surfaces**: `@contenz/core` for schema authors, `@contenz/core/api` for tool authors.
