# CLI reference

The `contenz` CLI is provided by `@contenz/cli`. All commands accept `--cwd` to run against a different project root.

## Commands overview

| Command | Description |
|---------|-------------|
| `contenz init` | Scaffold Contenz into the current (or `--cwd`) project |
| `contenz lint` | Validate all content and optionally write a coverage report |
| `contenz build` | Generate typed content files (incremental when possible) |
| `contenz watch` | Watch content and config, run build on change |
| `contenz status` | Report whether build is up to date or which collections would be rebuilt |
| `contenz studio` | Start the Contenz Authoring Studio (Next.js app) |
| `contenz view` | View a single content item by collection and slug |
| `contenz list` | List collections or items within a collection |
| `contenz create` | Create a new content item |
| `contenz update` | Update fields on an existing content item |
| `contenz search` | Search content items by slug or field values |
| `contenz schema` | Introspect the schema of a collection |

## Global behavior

- **Project root**: Commands look for `contenz.config.ts` (or `.mjs` / `.js`) in the current directory unless `--cwd <path>` is set.
- **Exit codes**: `status` exits `1` when a build is needed; other commands use non-zero on validation or build failure.
- **Output formats**: AI-native commands (`view`, `list`, `create`, `update`, `search`, `schema`) default to `--format json`. Pipeline commands (`lint`, `build`, `watch`) default to `--format pretty`.

---

## init

Scaffold Contenz into an existing project: create config, a starter collection schema, and sample content.

```bash
contenz init
contenz init --cwd ../my-app
contenz init --i18n
contenz init --collection blog --dir src/content
```

| Option | Default | Description |
|--------|---------|-------------|
| `--cwd` | `.` | Project root where `contenz.config.ts` and content will live. |
| `--dir` | `content` | Collection container directory to create. |
| `--collection` | `pages` | Starter collection name. |
| `--i18n` | `false` | Scaffold an i18n-ready config and sample locale-based content. |
| `--force` | `false` | Overwrite scaffold files if they already exist. |

After running `init`, install `@contenz/core` and `zod` in the target project if not already present, then run `contenz lint` or `contenz build`.

---

## lint

Validate all content against collection schemas, run relation checks, and optionally write a coverage report.

```bash
contenz lint
contenz lint --coverage
contenz lint --collection faq
contenz lint --format json
contenz lint --cwd ./content-repo
```

| Option | Default | Description |
|--------|---------|-------------|
| `--cwd` | `.` | Project root. |
| `--collection` | *(all)* | Limit validation to one collection name. |
| `--coverage` | `false` | Write the coverage report to the path in config (`coveragePath`). |
| `--format` | `pretty` | Output format: `pretty`, `json`, or `github`. |
| `--dry-run` | `false` | Run validation without writing the coverage file. |

- **pretty**: Human-readable terminal output.
- **json**: Machine-readable diagnostics for automation.
- **github**: Emit GitHub Actions workflow commands (e.g. annotations).

---

## build

Generate typed content files. Uses a manifest (`.contenz/build-manifest.json`) to skip unchanged collections.

```bash
contenz build
contenz build --force
contenz build --dry-run
contenz build --format github
contenz build --cwd ./content-repo
```

| Option | Default | Description |
|--------|---------|-------------|
| `--cwd` | `.` | Project root. |
| `--force` | `false` | Ignore manifest and rebuild all collections. |
| `--dry-run` | `false` | Report what would be built without writing files. |
| `--format` | `pretty` | Output format: `pretty`, `json`, or `github`. |

Output is written to the `outputDir` from config (default `generated/content/`). Each collection gets a TypeScript file (e.g. `faq.ts`). See [Content model – Generated output](./CONTENT-MODEL.md#generated-output-shape).

---

## watch

Watch content and config files; run build on change. Useful for local editing with live regeneration.

```bash
contenz watch
contenz watch --cwd ./content-repo
contenz watch --format json
```

| Option | Default | Description |
|--------|---------|-------------|
| `--cwd` | `.` | Project root. |
| `--format` | `pretty` | Diagnostic formatter for the inner build. |

Watched paths are derived from project config `sources`. Changes to `contenz.config.*`, `**/schema.ts`, `**/config.ts`, and `*.md`/`*.mdx` trigger a debounced build. Press Ctrl+C to stop.

---

## status

Report whether the last build is still up to date or which collections would be rebuilt.

```bash
contenz status
contenz status --cwd ./content-repo
```

| Option | Default | Description |
|--------|---------|-------------|
| `--cwd` | `.` | Project root. |

Exit code is `0` when up to date, `1` when a build is needed. Useful in CI or scripts to decide whether to run `contenz build`.

---

## studio

Start the Contenz Authoring Studio: a Next.js app that lets you browse collections, open documents, edit metadata and body, and search content. The app reads and writes content in the repo via `CONTENZ_PROJECT_ROOT`.

```bash
contenz studio
contenz studio --cwd ./my-content
contenz studio --port 3002
```

| Option | Default | Description |
|--------|---------|-------------|
| `--cwd` | `.` | Project root (content sources and `contenz.config`). Becomes `CONTENZ_PROJECT_ROOT`. |
| `--port` | `3001` | Port for the studio dev server. |

The CLI resolves `@contenz/studio`, sets `CONTENZ_PROJECT_ROOT` to the resolved `--cwd`, and runs the studio's `npm run dev` with the given port. Open the printed URL (e.g. http://localhost:3001). See [Studio](./STUDIO.md) for details.

---

## view

View a single content item by collection and slug. Returns the full metadata and body.

```bash
contenz view faq hello
contenz view faq moq --locale zh
contenz view faq hello --format pretty
```

| Option | Default | Description |
|--------|---------|-------------|
| `<collection>` | *(required)* | Collection name (positional). |
| `<slug>` | *(required)* | Content slug (positional). |
| `--locale` | *(default locale)* | Locale to read (for i18n collections). |
| `--cwd` | `.` | Project root. |
| `--format` | `json` | Output format: `json` or `pretty`. |

**JSON output shape** (`--format json`):

```json
{
  "success": true,
  "data": {
    "slug": "hello",
    "locale": null,
    "file": "/path/to/content/faq/hello.mdx",
    "meta": { "question": "What is contenz?", "category": "products" },
    "body": "The content body..."
  }
}
```

---

## list

List all collections in a project, or list all content items within a specific collection.

```bash
# List all collections
contenz list
contenz list --format pretty

# List items in a collection
contenz list faq
contenz list faq --format json
```

| Option | Default | Description |
|--------|---------|-------------|
| `<collection>` | *(optional)* | Collection name (positional). Omit to list all collections. |
| `--cwd` | `.` | Project root. |
| `--format` | `json` | Output format: `json` or `pretty`. |

**JSON output — list collections**:

```json
{
  "success": true,
  "data": {
    "collections": [
      { "name": "faq", "path": "content/faq", "items": 5, "i18n": true, "fields": ["question", "category"] }
    ]
  }
}
```

**JSON output — list items**:

```json
{
  "success": true,
  "data": {
    "collection": "faq",
    "items": [
      { "slug": "hello", "locale": "en", "file": "hello.en.mdx", "ext": "mdx" }
    ]
  }
}
```

---

## create

Create a new content item in a collection. Validates metadata against the schema before writing.

```bash
contenz create faq hello --set question="What is contenz?" --set category=products
contenz create faq moq --locale zh --set question="最低起订量是多少？" --set category=ordering
contenz create terms glossary-item --type term --set term="API"
```

| Option | Default | Description |
|--------|---------|-------------|
| `<collection>` | *(required)* | Collection name (positional). |
| `<slug>` | *(required)* | Content slug (positional). |
| `--set` | — | Set field values (`key=value`). Repeatable. Values are parsed as JSON when possible, otherwise as strings. |
| `--locale` | *(default locale)* | Locale for the content item (required when i18n is enabled). |
| `--type` | — | Content type (for multi-type collections). |
| `--cwd` | `.` | Project root. |
| `--format` | `json` | Output format: `json` or `pretty`. |

Schema defaults are automatically applied. If required fields are missing or validation fails, the command exits with `1` and includes diagnostics.

**JSON output**:

```json
{
  "success": true,
  "data": {
    "slug": "hello",
    "collection": "faq",
    "file": "/path/to/content/faq/hello.mdx",
    "meta": { "question": "What is contenz?", "category": "products" }
  }
}
```

---

## update

Update fields on an existing content item. Preserves the body and any fields not explicitly modified.

```bash
contenz update faq hello --set question="Updated question?"
contenz update faq moq --locale zh --set category=ordering
contenz update faq hello --unset deprecated
contenz update faq hello --set question="New" --unset oldField
```

| Option | Default | Description |
|--------|---------|-------------|
| `<collection>` | *(required)* | Collection name (positional). |
| `<slug>` | *(required)* | Content slug (positional). |
| `--set` | — | Set field values (`key=value`). Repeatable. |
| `--unset` | — | Remove optional fields by name. Repeatable. |
| `--locale` | *(default locale)* | Locale to update. |
| `--cwd` | `.` | Project root. |
| `--format` | `json` | Output format: `json` or `pretty`. |

The merged metadata is validated against the schema before writing. At least one `--set` or `--unset` is required.

---

## search

Search content items in a collection by slug substring and/or field-value filters.

```bash
contenz search faq hello
contenz search faq --field category=products
contenz search faq moq --locale en --limit 10
```

| Option | Default | Description |
|--------|---------|-------------|
| `<collection>` | *(required)* | Collection name (positional). |
| `<query>` | *(optional)* | Substring to match against slugs (positional). |
| `--field` | — | Filter by field value (`key=value`). Repeatable. |
| `--locale` | — | Filter by locale (for i18n collections). |
| `--limit` | `50` | Maximum number of results. |
| `--cwd` | `.` | Project root. |
| `--format` | `json` | Output format: `json` or `pretty`. |

**JSON output**:

```json
{
  "success": true,
  "data": {
    "collection": "faq",
    "query": "hello",
    "filters": {},
    "total": 1,
    "items": [
      { "slug": "hello", "locale": null, "file": "hello.mdx", "meta": { "question": "...", "category": "products" } }
    ]
  }
}
```

---

## schema

Introspect the schema of a collection. Returns field names, types, required/optional status, descriptions, defaults, and enum values.

```bash
contenz schema faq
contenz schema terms --type term
contenz schema faq --format pretty
```

| Option | Default | Description |
|--------|---------|-------------|
| `<collection>` | *(required)* | Collection name (positional). |
| `--type` | — | Content type (for multi-type collections). |
| `--cwd` | `.` | Project root. |
| `--format` | `json` | Output format: `json` or `pretty`. |

**JSON output**:

```json
{
  "success": true,
  "data": {
    "collection": "faq",
    "contentType": null,
    "schema": {
      "fields": {
        "question": { "type": "string", "required": true },
        "category": { "type": "enum", "required": true, "options": ["products", "ordering"] }
      }
    },
    "relations": null
  }
}
```

This is the recommended entry point for AI agents to discover what fields a collection expects before calling `create` or `update`.
