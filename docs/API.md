# Core API reference

This page summarizes the programmatic API from `@contenz/core/api`. Use it when building tooling, the Studio, or custom scripts on top of Contenz.

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

## Parsing and serialization

| Export | Description |
|--------|-------------|
| `parseFileName(fileName, i18n, slugPattern?)` | Parse slug (and locale if i18n) from a filename. |
| `parseContentFile(filePath, config)` | Parse a content file; returns `ParsedContent` (meta, body, slug, locale, etc.). |
| `extractBodyFromSource(source, ext)` | Extract body from raw file content (after frontmatter or export block). |
| `serializeContentFile(meta, body, ext)` | Serialize meta + body to string (frontmatter + body for md/mdx). |

**Types**: `ParsedContent` (see core types).

## Validation

| Export | Description |
|--------|-------------|
| `validateMeta(meta, schema, filePath?)` | Validate metadata against a Zod schema. Returns `ValidationResult` (`valid`, `errors: { field, message }[]`). |

**Types**: `ValidationResult`, `ValidationError`.

## Build, lint, and status

| Export | Description |
|--------|-------------|
| `runBuild(options)` | Run the full build. Uses manifest for incremental rebuilds. Returns `BuildResult` (`success`, `report`, etc.). |
| `runLint(options)` | Run validation and optional coverage. Returns `LintResult` (`success`, `diagnostics`, `report`, etc.). |
| `runStatus(options)` | Compare input hashes to manifest. Returns `StatusResult` (`status: 'up-to-date' | 'needs-build'`, `message`, `dirtyCollections`, `freshCollections`). |

**Options**:

- **BuildOptions**: `cwd`, `force?`, `dryRun?`, `format?: 'pretty' | 'json' | 'github'`.
- **LintOptions**: `cwd`, `collection?`, `coverage?`, `dryRun?`, `format?`.
- **StatusOptions**: `cwd`.

## Diagnostics

Diagnostics are returned as part of lint/build results and have a stable shape:

- **Diagnostic**: `code`, `message`, `severity`, `file`, `line`, etc.
- **DiagnosticSummary**, **DiagnosticFormat**: for aggregated and formatted output.

## Example

```ts
import {
  loadProjectConfig,
  resolveConfig,
  discoverCollections,
  runBuild,
  runLint,
  runStatus,
} from "@contenz/core/api";

const cwd = process.cwd();
const projectConfig = await loadProjectConfig(cwd);
const { sources } = resolveConfig(projectConfig);
const { collections } = await discoverCollections(cwd, sources);

const lintResult = await runLint({ cwd, coverage: true });
const buildResult = await runBuild({ cwd });
const statusResult = await runStatus({ cwd });
```

For schema authoring (e.g. `defineCollection`, `defineMultiTypeCollection`) use the default `@contenz/core` entry point; see [Configuration – Schema authoring](./CONFIGURATION.md#schema-authoring) and [packages/core/README.md](../packages/core/README.md).
