# Contenz Codebase Reference

> **Purpose**: Developer reference for maintainers and AI agents working on the contenz monorepo.
> Contains architecture overview, module map, known issues, and actionable cleanup items.

---

## Monorepo Structure

```
contenz/
├── packages/
│   ├── core/          # @contenz/core — schema validation, codegen, workspace, introspection
│   ├── cli/           # @contenz/cli — citty-based CLI (12 commands)
│   ├── adapter-mdx/   # @contenz/adapter-mdx — MD/MDX format adapter (peer dep on core)
│   └── e2e/           # @contenz/e2e — integration tests (6 fixture projects)
├── docs/              # Project documentation (8 files)
├── turbo.json         # Turborepo task config
└── package.json       # Workspace root (npm workspaces)
```

### Package Dependency Graph

```
adapter-mdx ──peer──▸ core
cli ──────────dep───▸ core
e2e ──────────dev───▸ core, cli, adapter-mdx
```

### Build Tooling

| Tool | Version | Purpose |
|---|---|---|
| TypeScript | 6.x | Type checking (`tsc --noEmit`) |
| tsup | 8.x | Bundling (core, cli, adapter-mdx) |
| Vitest | 4.x | Testing (core, e2e) |
| Biome | 2.x | Linting + formatting (core) |
| Turbo | 2.x | Task orchestration |
| Zod | 4.x (3.25 compat) | Schema validation runtime |
| Husky | 9.x | Git hooks |

---

## @contenz/core — Module Map

The core package has **two export entry points**:

| Entry | Path | Purpose |
|---|---|---|
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

| Command | Source | Core Function |
|---|---|---|
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

### CLI Shared Utilities

- `output.ts` — `printAndExit(result, format)` handles JSON vs pretty output for all content ops

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

Built-in defaults: `extensions: ["md", "mdx", "json"]`, `sources: ["content/*"]`, `outputDir: "generated/content"`

---

## Cleanup Items

Actionable items ordered by priority. Each is self-contained and can be executed independently.

### ✅ DONE: Dead Studio Package

Removed in this session: deleted `packages/studio/`, `commands/studio.ts`, `docs/STUDIO.md`, `@contenz/studio` dependency, and all doc references.

### 🔴 REMOVE: `metaSchema` Legacy Alias

`defineCollection()` returns both `meta` and `metaSchema` pointing to the same schema. `metaSchema` is a legacy name. Both `run-build.ts` and `run-lint.ts` use a fallback pattern `schemaModule.meta || schemaModule.metaSchema`.

**Files to change:**
1. **Remove** `metaSchema` from `define-collection.ts` return values and overload signatures
2. **Remove** `|| (schemaModule as Record<string, unknown>).metaSchema` fallback from `run-build.ts:178` and `run-lint.ts:95`
3. **Update** all fixture `schema.ts` files to destructure only `{ meta, relations }` (drop `metaSchema`)
4. **Update** `packages/cli/src/commands/init.ts:64` scaffolded template

### 🟡 FIX: `init` Command Scaffolds Stale Content

`init.ts` scaffolds `.mdx` files with `export const meta = { ... }` syntax but:
- Does not include `@contenz/adapter-mdx` in install instructions
- Does not add `adapters: [mdxAdapter]` to the generated config
- Comment says default extensions are `["md", "mdx"]` — actual default is `["md", "mdx", "json"]`

**Fix:** Either scaffold `.json` files (zero-adapter), or include adapter setup in generated config.

### 🟡 CONSOLIDATE: `index.ts` vs `api.ts` Export Overlap

Both entry points export overlapping symbols:

| Symbol | `index.ts` | `api.ts` |
|---|---|---|
| `readContent`, `writeContent`, etc. | ✅ | ✅ |
| `FormatAdapter`, `registerAdapters` | ✅ | ✅ |
| `introspectSchema`, `introspectField` | ✅ | ✅ |
| `createWorkspace`, `CollectionContext` | ✅ | ✅ |
| All types | ✅ | ✅ |
| `defineCollection` | ✅ | ❌ |
| `runBuild`, `runLint`, `runStatus` | ❌ | ✅ |
| `runView`, `runList`, `runCreate` | ❌ | ✅ |

**Decision needed:** Should `index.ts` be a _subset_ of `api.ts`? Currently `index.ts` has content-io and workspace which feel like programmatic API. Consider:
- `@contenz/core` = schema helpers only (`defineCollection`, types)
- `@contenz/core/api` = everything

### 🟡 DRY: Duplicate Schema Resolution in run-build and run-lint

Both `run-build.ts:178` and `run-lint.ts:95` have identical blocks:

```ts
const rawSchema = schemaModule.meta || (schemaModule as Record<string, unknown>).metaSchema;
if (!rawSchema) {
  diagnostics.push({ code: "SCHEMA_EXPORT_MISSING", ... });
  return ...;
}
```

**Fix:** Extract to a shared helper like `resolveDefaultSchema(schemaModule): ZodSchema | null` in `config.ts`.

### 🟡 DRY: Duplicate Diagnostics Push in run-build and run-lint

Both files push identical `SCHEMA_LOAD_FAILED` and `SCHEMA_EXPORT_MISSING` diagnostics. Extract to `diagnostics.ts` as factory functions.

### 🟠 CLEAN: `test-fixtures.ts` Fragile Import Rewriting

`test-fixtures.ts` copies e2e fixtures to temp dirs and does string replacement of `"@contenz/core"` → absolute file URL pointing to source. This is fragile and breaks if import syntax changes.

**Alternative:** Use symlinks in `node_modules` (the pattern already used in e2e tests).

### 🟠 CLEAN: `ContentExtension` Hardcoded Type

`parser.ts:6` defines `ContentExtension = "mdx" | "md" | "json"`. This is a closed union that doesn't support user-defined adapters.

**Fix:** Change to `string` and validate against registered adapters at runtime.

### 🟠 CLEAN: Hardcoded Filename Patterns in parser.ts

`I18N_PATTERN` and `NON_I18N_PATTERN` in `parser.ts` hardcode `mdx|md|json`. These should be derived from registered adapter extensions.

### 🟠 CLEAN: `run-content-ops.ts` Has Mixed Responsibilities

This file contains 4 unrelated operations: `runList`, `runView`, `runCreate`, `runUpdate`. Each is independent. Consider splitting into separate files to match `run-search.ts` and `run-schema.ts` pattern.

### 🟠 DOCS: Stale Documentation

| File | Issue |
|---|---|
| `docs/CONFIGURATION.md` | May reference old defaults |
| `Plan.md` (55KB) | Very large planning doc — consider archiving |
| `Backlog.md` | May contain completed items |
| `ROADMAP.md` | May contain completed milestones |
| `README.md` (root) | May need updates |

### 🟠 CLEAN: Global Mutable Adapter Registry

`format-adapter.ts` uses a module-level `adapterRegistry` array. This is a singleton that leaks state between Vitest workers.

**Fix options:**
1. Add `resetAdapters()` export for test isolation
2. Move registry into `Workspace` so each workspace instance has its own adapter set

---

## Test Architecture

| Package | Runner | Files | Tests |
|---|---|---|---|
| core | Vitest | 7 test files | 72 |
| e2e | Vitest | 2 test files | 114 |

### Core Tests

Core tests live alongside source files (`*.test.ts`). They use `test-fixtures.ts` to copy e2e fixture projects to temp dirs.

### E2E Tests

E2E tests live in `packages/e2e/`. They use 6 fixture projects under `packages/e2e/fixtures/`:

| Fixture | Purpose |
|---|---|
| `minimal` | Basic single-collection, flat |
| `i18n` | Multi-locale collection |
| `multi-type` | Collection with multiple content types |
| `mixed-sources` | Multiple source patterns |
| `invalid-schema` | Schema validation error cases |
| `invalid-relation` | Relation validation error cases |

E2E tests spawn CLI processes and validate output. They symlink `@contenz/core` and `@contenz/adapter-mdx` into fixture `node_modules/` in `beforeAll`.

---

## Key Design Decisions

1. **Adapter pattern**: Format support is extensible via `FormatAdapter`. JSON is built-in, MD/MDX is external (`@contenz/adapter-mdx`). Users register adapters in `contenz.config.ts`.

2. **Workspace as single entry point**: All pipelines load config via `createWorkspace()`. No manual config loading elsewhere.

3. **Zod 3.25 compatibility**: Internal `_def` access uses `as any` casts. The Zod v4 engine changed `_def.typeName` → `_def.type`, `_def.shape()` → `_def.shape` (plain object), and `_def.description` → `schema.description`.

4. **Incremental builds**: `run-build.ts` uses manifest-based hashing to skip unchanged collections.

5. **Two export surfaces**: `@contenz/core` for schema authors, `@contenz/core/api` for tool authors.
