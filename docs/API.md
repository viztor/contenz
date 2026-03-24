# Core API reference

This page summarizes the programmatic API from `@contenz/core/api`. Use it when building tooling or custom scripts on top of Contenz.

**Entry point**: `@contenz/core/api` (not the default `@contenz/core` export, which is for schema helpers and types).

## Config and discovery

| Export | Description |
|--------|-------------|
| `loadProjectConfig(cwd)` | Load root config from `contenz.config.ts` (or `.mjs`/`.js`). Returns `ContenzConfig`. |
| `loadCollectionConfig(collectionPath)` | Load collection config from `config.ts` in the given path. Returns `CollectionConfig`. |
| `resolveConfig(projectConfig, collectionConfig?)` | Merge project and optional collection config into a `ResolvedConfig`. |
| `resolveSourcePatterns(projectConfig)` | Resolve `sources` (or legacy `contentDir`) to a list of glob patterns. |
| `discoverCollections(cwd, sources)` | Discover collection roots. Returns `{ collections: DiscoveredCollection[] }`. |
| `loadSchemaModule(collectionPath)` | Load the schema module (`schema.ts`) for a collection. Returns `SchemaModule \| null`. |
| `getSchemaForType(schemaModule, contentType)` | Get the Zod schema for a content type (for multi-type: `term`, `topic`, etc.; else default). |
| `getContentType(filename, config)` | Infer content type from filename using collection `types` patterns. |
| `extractRelations(schemaModule)` | Get relations map from the schema module. |

**Types**: `ContenzConfig`, `CollectionConfig`, `ResolvedConfig`, `DiscoveredCollection`, `SchemaModule` (from `@contenz/core` or `@contenz/core/api`).

## Workspace

The `Workspace` module provides a consolidated loading mechanism that eliminates repeated config/discovery/schema loading.

| Export | Description |
|--------|-------------|
| `createWorkspace(options)` | Load project config, discover collections, and pre-load each collection's config, schema, and file list. Returns `Workspace`. |
| `Workspace.getCollection(name)` | Get a `CollectionContext` by collection name. |

**CreateWorkspaceOptions**: `cwd` (required), `sources?`, `collection?` (filter to a single collection).

**CollectionContext**: `name`, `collectionPath`, `config` (merged), `schema`, `contentFiles`.

## Parsing and serialization

| Export | Description |
|--------|-------------|
| `parseFileName(fileName, i18n, slugPattern?)` | Parse slug (and locale if i18n) from a filename. |
| `parseContentFile(filePath, config)` | Parse a content file; returns `ParsedContent` (meta, body, slug, locale, etc.). |
| `extractBodyFromSource(source, ext)` | Extract body from raw file content (after frontmatter or export block). |
| `serializeContentFile(meta, body, ext)` | Serialize meta + body to string (frontmatter + body for md/mdx). |

**Types**: `ParsedContent` (see core types).

## Format adapters

| Export | Source | Description |
|--------|--------|-------------|
| `getAdapterForExtension(ext)` | `@contenz/core/api` | Get the registered format adapter for a file extension. Returns `FormatAdapter \| null`. |
| `jsonAdapter` | `@contenz/core/api` | Built-in adapter for `.json` files. Registered automatically. |
| `registerAdapters(adapters)` | `@contenz/core/api` | Register format adapters (called internally by `createWorkspace`). |
| `mdxAdapter` | `@contenz/adapter-mdx` | External adapter for `.md` and `.mdx` files. Must be registered via `adapters` in config. |

**FormatAdapter interface**: `extensions: string[]`, `extract(source, filePath)`, `serialize(meta, body?)`.

Note: `mdxAdapter` handles both `.md` and `.mdx` files with dual syntax support (frontmatter and `export const meta`). It is **not** included in `@contenz/core` — install `@contenz/adapter-mdx` separately.

## Validation

| Export | Description |
|--------|-------------|
| `validateMeta(meta, schema, filePath?)` | Validate metadata against a Zod schema. Returns `ValidationResult` (`valid`, `errors: { field, message }[]`). |

**Types**: `ValidationResult`, `ValidationError`.

## Schema introspection

| Export | Description |
|--------|-------------|
| `introspectSchema(schema, descriptions?)` | Extract field metadata from a Zod schema without validation. Returns `IntrospectedSchema`. |
| `introspectField(schema)` | Recursively introspect a single Zod field. Returns `IntrospectedField`. |

**IntrospectedField**: `type`, `required`, `description?`, `default?`, `itemType?` (arrays), `shape?` (objects), `options?` (enums).

## Build, lint, and status

| Export | Description |
|--------|-------------|
| `runBuild(options)` | Run the full build. Uses manifest for incremental rebuilds. Returns `BuildResult` (`success`, `report`, etc.). |
| `runLint(options)` | Run validation and optional coverage. Returns `LintResult` (`success`, `diagnostics`, `report`, etc.). |
| `runStatus(options)` | Compare input hashes to manifest. Returns `StatusResult` (`status: 'up-to-date' \| 'needs-build'`, `message`, `dirtyCollections`, `freshCollections`). |

**Options**:

- **BuildOptions**: `cwd`, `force?`, `dryRun?`, `format?: 'pretty' | 'json' | 'github'`.
- **LintOptions**: `cwd`, `collection?`, `coverage?`, `dryRun?`, `format?`.
- **StatusOptions**: `cwd`.

## Content operations

These APIs mirror the AI-native CLI commands. They accept clean options objects and return structured `ContentOpResult<T>` results—never call `console.log` or `process.exit`.

| Export | Description |
|--------|-------------|
| `runList(opts)` | List collections (no `collection`) or items in a collection. |
| `runView(opts)` | Read a single content item by collection, slug, and optional locale. |
| `runCreate(opts)` | Create a new content item. Fills schema defaults, validates, writes file. |
| `runUpdate(opts)` | Surgically update fields (`--set`, `--unset`) on an existing item. Validates merged state. |
| `runSearch(opts)` | Search items by slug substring and/or field-value filters. |
| `runSchema(opts)` | Introspect a collection's schema. Returns field metadata, types, and relations. |

**ContentOpResult\<T\>**: `{ success: boolean, data?: T, error?: string, diagnostics?: Array<{ field?, message }> }`.

### Options and result types

| Function | Options type | Result data type |
|----------|-------------|-----------------|
| `runList` | `ListOptions` (`cwd`, `collection?`) | `{ collections: CollectionInfo[] }` or `{ collection, items: ListItemInfo[] }` |
| `runView` | `ViewOptions` (`cwd`, `collection`, `slug`, `locale?`) | `ViewResult` (`slug`, `locale`, `file`, `meta`, `body?`) |
| `runCreate` | `CreateOptions` (`cwd`, `collection`, `slug`, `meta`, `locale?`, `contentType?`) | `CreateResult` (`slug`, `collection`, `file`, `meta`) |
| `runUpdate` | `UpdateOptions` (`cwd`, `collection`, `slug`, `set?`, `unset?`, `locale?`) | `UpdateResult` (`slug`, `collection`, `file`, `meta`) |
| `runSearch` | `SearchOptions` (`cwd`, `collection`, `query?`, `fields?`, `locale?`, `limit?`) | `SearchResultData` (`collection`, `query`, `filters`, `total`, `items`) |
| `runSchema` | `SchemaOptions` (`cwd`, `collection`, `contentType?`) | `SchemaResultData` (`collection`, `contentType`, `schema`, `relations`) |

## Diagnostics

Diagnostics are returned as part of lint/build results and have a stable shape:

- **Diagnostic**: `code`, `message`, `severity`, `file`, `line`, etc.
- **DiagnosticSummary**, **DiagnosticFormat**: for aggregated and formatted output.

## Example

```ts
import {
  runBuild,
  runLint,
  runStatus,
  runList,
  runView,
  runCreate,
  runUpdate,
  runSearch,
  runSchema,
} from "@contenz/core/api";

const cwd = process.cwd();

// Pipeline operations
const lintResult = await runLint({ cwd, coverage: true });
const buildResult = await runBuild({ cwd });
const statusResult = await runStatus({ cwd });

// Content operations (AI-native)
const collections = await runList({ cwd });
const schema = await runSchema({ cwd, collection: "faq" });
const item = await runView({ cwd, collection: "faq", slug: "hello" });
const results = await runSearch({ cwd, collection: "faq", query: "moq" });
const created = await runCreate({ cwd, collection: "faq", slug: "new-item", meta: { question: "Q?", category: "products" } });
const updated = await runUpdate({ cwd, collection: "faq", slug: "hello", set: { question: "Updated?" } });
```

For schema authoring (e.g. `defineCollection`, `defineMultiTypeCollection`) use the default `@contenz/core` entry point; see [Configuration – Schema authoring](./CONFIGURATION.md#schema-authoring) and [packages/core/README.md](../packages/core/README.md).
