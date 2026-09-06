---
tags:
  - docs
  - contenz
status: note
---

# CLI reference

The `contenz` CLI is provided by `@contenz/cli`, built with [Stricli](https://bloomberg.github.io/stricli/) for type-safe flags, help, version, and shell completion. All commands accept `--cwd` to run against a different project root.

## Commands overview

| Command          | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| `contenz init`   | Scaffold Contenz into the current (or `--cwd`) project                   |
| `contenz lint`   | Validate all content and optionally write a coverage report              |
| `contenz build`  | Generate typed content files (incremental when possible)                 |
| `contenz watch`  | Watch content and config, run build on change                            |
| `contenz status` | Report whether build is up to date or which collections would be rebuilt |
| `contenz view`   | View a single content item by collection and slug                        |
| `contenz list`   | List collections or items within a collection                            |
| `contenz create` | Create a new content item                                                |
| `contenz update` | Update fields on an existing content item                                |
| `contenz search` | Search content items by slug or field values                             |
| `contenz schema` | Introspect the schema of a collection                                    |
| `contenz skill`  | Generate an AI agent SKILL.md for the project content model              |

## Global behavior

- **Help / version**: `contenz --help`, `contenz <command> --help`, `contenz --version` (`-h` / `-v`).
- **Project root**: Commands look for `contenz.config.ts` (or `.mjs` / `.js`) in the current directory unless `--cwd <path>` is set.
- **Flag style**: Flags are camelCase in the implementation; kebab-case is accepted (`--dry-run` ↔ `dryRun`).
- **Enums**: `--format` is validated (`pretty` \| `json` \| `github` for pipeline; `json` \| `pretty` for AI-native).
- **Variadic flags**: `--set` / `--unset` / `--field` may be repeated.
- **Exit codes**: `status` exits `1` when a build is needed; other commands use non-zero on validation or build failure.
- **Output formats**: AI-native commands (`view`, `list`, `create`, `update`, `search`, `schema`) default to `--format json`. Pipeline commands (`lint`, `build`, `watch`) default to `--format pretty`.

## Shell completion (bash)

After installing `@contenz/cli` globally or linking the workspace binary:

```bash
contenz install          # appends completion hooks to ~/.bashrc
# restart shell or: source ~/.bashrc
contenz uninstall        # removes the hooks
```

`install` / `uninstall` are hidden from default help (`contenz --helpAll` shows them).

---

## init

Scaffold Contenz into an existing project: create config, a starter collection schema, and sample content.

```bash
contenz init
contenz init --cwd ../my-app
contenz init --i18n
contenz init --collection blog --dir src/content
```

| Option         | Default   | Description                                                    |
| -------------- | --------- | -------------------------------------------------------------- |
| `--cwd`        | `.`       | Project root where `contenz.config.ts` and content will live.  |
| `--dir`        | `content` | Collection container directory to create.                      |
| `--collection` | `pages`   | Starter collection name.                                       |
| `--i18n`       | `false`   | Scaffold an i18n-ready config and sample locale-based content. |
| `--force`      | `false`   | Overwrite scaffold files if they already exist.                |

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

| Option           | Default  | Description                                                                                                       |
| ---------------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `--cwd`          | `.`      | Project root.                                                                                                     |
| `--collection`   | _(all)_  | Limit validation to one collection name.                                                                          |
| `--coverage`     | `false`  | Write the coverage report to the path in config (`coveragePath`).                                                 |
| `--translations` | `false`  | Check translation completeness against the declared `i18n.locales` list and emit missing-translation diagnostics. |
| `--format`       | `pretty` | Output format: `pretty`, `json`, or `github`.                                                                     |
| `--dry-run`      | `false`  | Run validation without writing the coverage file.                                                                 |

- **pretty**: Human-readable terminal output.
- **json**: Machine-readable diagnostics for automation.
- **github**: Emit GitHub Actions workflow commands (e.g. annotations).

### Missing translations (`--translations`)

When the project config declares supported locales (`i18n: { locales: ["en", "zh", "ja"] }`), `lint --translations` checks every slug against that list and emits `I18N_MISSING_TRANSLATION` diagnostics. The check is opt-in so default lint output stays focused on schema and relation errors. Each diagnostic carries `collection`, `slug`, `locale` (the missing one), and `file` (the default-locale source file), so the JSON output can be piped directly to an AI agent as a translation work queue:

```bash
contenz lint --translations --format json | jq '[.diagnostics[]
  | select(.code == "I18N_MISSING_TRANSLATION")
  | {collection, slug, locale, file}]'
```

```json
[
  { "collection": "faq", "slug": "moq", "locale": "ja", "file": "moq.en.json" },
  {
    "collection": "faq",
    "slug": "hello",
    "locale": "zh",
    "file": "hello.en.json"
  }
]
```

For each work item, an agent reads the source with `contenz view <collection> <slug> --locale <defaultLocale>` and writes the translation with `contenz create <collection> <slug> --locale <missing>`. See the [translation pipeline reference](../skills/contenz/references/translation-pipeline.md) for the full workflow.

`I18N_COVERAGE_BELOW_THRESHOLD` is emitted when the ratio of fully translated slugs drops below `coverageThreshold`. Both codes are warnings by default and become errors (exit 1) with `strict: true`.

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

| Option      | Default  | Description                                       |
| ----------- | -------- | ------------------------------------------------- |
| `--cwd`     | `.`      | Project root.                                     |
| `--force`   | `false`  | Ignore manifest and rebuild all collections.      |
| `--dry-run` | `false`  | Report what would be built without writing files. |
| `--format`  | `pretty` | Output format: `pretty`, `json`, or `github`.     |

Output is written to the `outputDir` from config (default `generated/content/`). Each collection gets a TypeScript file (e.g. `faq.ts`). See [[CONTENT-MODEL#generated-output-shape|Content model – Generated output]].

---

## watch

Watch content and config files; run build on change. Useful for local editing with live regeneration.

```bash
contenz watch
contenz watch --cwd ./content-repo
contenz watch --format json
```

| Option     | Default  | Description                               |
| ---------- | -------- | ----------------------------------------- |
| `--cwd`    | `.`      | Project root.                             |
| `--format` | `pretty` | Diagnostic formatter for the inner build. |

Watched paths are derived from project config `sources`. Changes to `contenz.config.*`, `**/schema.ts`, `**/config.ts`, and `*.md`/`*.mdx` trigger a debounced build. Press Ctrl+C to stop.

---

## status

Report whether the last build is still up to date or which collections would be rebuilt.

```bash
contenz status
contenz status --cwd ./content-repo
```

| Option  | Default | Description   |
| ------- | ------- | ------------- |
| `--cwd` | `.`     | Project root. |

Exit code is `0` when up to date, `1` when a build is needed. Useful in CI or scripts to decide whether to run `contenz build`.

---

## view

View a single content item by collection and slug. Returns the full metadata and body.

```bash
contenz view faq hello
contenz view faq moq --locale zh
contenz view faq hello --format pretty
contenz view site              # singles: slug omitted, defaults to the name
```

| Option         | Default            | Description                                       |
| -------------- | ------------------ | ------------------------------------------------- |
| `<collection>` | _(required)_       | Collection or single name (positional).           |
| `<slug>`       | _(required)_       | Content slug (positional). Omit only for singles. |
| `--locale`     | _(default locale)_ | Locale to read (for i18n collections).            |
| `--cwd`        | `.`                | Project root.                                     |
| `--format`     | `json`             | Output format: `json` or `pretty`.                |

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
# List all collections (and singles)
contenz list
contenz list --format pretty

# List items in a collection (or locale variants of a single)
contenz list faq
contenz list site
contenz list faq --format json
```

| Option         | Default      | Description                                                 |
| -------------- | ------------ | ----------------------------------------------------------- |
| `<collection>` | _(optional)_ | Collection name (positional). Omit to list all collections. |
| `--cwd`        | `.`          | Project root.                                               |
| `--format`     | `json`       | Output format: `json` or `pretty`.                          |

**JSON output — list collections**:

```json
{
  "success": true,
  "data": {
    "collections": [
      {
        "name": "faq",
        "path": "content/faq",
        "items": 5,
        "i18n": true,
        "fields": ["question", "category"]
      }
    ],
    "singles": [{ "name": "site", "path": "data", "items": 2, "i18n": true }]
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

Create a new content item in a collection. Validates metadata against the schema before writing. Rejected for singles (key-fixed — edit the file with `update` instead).

```bash
contenz create faq hello --set question="What is contenz?" --set category=products
contenz create faq moq --locale zh --set question="最低起订量是多少？" --set category=ordering
contenz create terms glossary-item --type term --set term="API"
```

| Option         | Default            | Description                                                                                                |
| -------------- | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `<collection>` | _(required)_       | Collection name (positional).                                                                              |
| `<slug>`       | _(required)_       | Content slug (positional).                                                                                 |
| `--set`        | —                  | Set field values (`key=value`). Repeatable. Values are parsed as JSON when possible, otherwise as strings. |
| `--locale`     | _(default locale)_ | Locale for the content item (required when i18n is enabled).                                               |
| `--type`       | —                  | Content type (for multi-type collections).                                                                 |
| `--cwd`        | `.`                | Project root.                                                                                              |
| `--format`     | `json`             | Output format: `json` or `pretty`.                                                                         |

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
contenz update site --set title="Renamed"   # singles: slug omitted
```

| Option         | Default            | Description                                  |
| -------------- | ------------------ | -------------------------------------------- |
| `<collection>` | _(required)_       | Collection or single name (positional).      |
| `<slug>`       | _(required)_       | Content slug (positional). Omit for singles. |
| `--set`        | —                  | Set field values (`key=value`). Repeatable.  |
| `--unset`      | —                  | Remove optional fields by name. Repeatable.  |
| `--locale`     | _(default locale)_ | Locale to update.                            |
| `--cwd`        | `.`                | Project root.                                |
| `--format`     | `json`             | Output format: `json` or `pretty`.           |

The merged metadata is validated against the schema before writing. At least one `--set` or `--unset` is required.

---

## search

Search content items in a collection by slug substring and/or field-value filters.

```bash
contenz search faq hello
contenz search faq --field category=products
contenz search faq moq --locale en --limit 10
```

| Option         | Default      | Description                                      |
| -------------- | ------------ | ------------------------------------------------ |
| `<collection>` | _(required)_ | Collection name (positional).                    |
| `<query>`      | _(optional)_ | Substring to match against slugs (positional).   |
| `--field`      | —            | Filter by field value (`key=value`). Repeatable. |
| `--locale`     | —            | Filter by locale (for i18n collections).         |
| `--limit`      | `50`         | Maximum number of results.                       |
| `--cwd`        | `.`          | Project root.                                    |
| `--format`     | `json`       | Output format: `json` or `pretty`.               |

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
      {
        "slug": "hello",
        "locale": null,
        "file": "hello.mdx",
        "meta": { "question": "...", "category": "products" }
      }
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

| Option         | Default      | Description                                |
| -------------- | ------------ | ------------------------------------------ |
| `<collection>` | _(required)_ | Collection name (positional).              |
| `--type`       | —            | Content type (for multi-type collections). |
| `--cwd`        | `.`          | Project root.                              |
| `--format`     | `json`       | Output format: `json` or `pretty`.         |

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
        "category": {
          "type": "enum",
          "required": true,
          "options": ["products", "ordering"]
        }
      }
    },
    "relations": null
  }
}
```

This is the recommended entry point for AI agents to discover what fields a collection expects before calling `create` or `update`.

---

## skill

Generate a `SKILL.md` document that teaches AI agents how to work with this project's content model and Contenz CLI commands.

```bash
contenz skill
contenz skill --cwd ./content-repo
contenz skill --format json
```

| Option     | Default | Description                                                                                     |
| ---------- | ------- | ----------------------------------------------------------------------------------------------- |
| `--cwd`    | `.`     | Project root.                                                                                   |
| `--format` | `md`    | Output format: `md` (prints SKILL.md content to stdout) or `json` (enveloped `RunSkillResult`). |

With `--format md` (default), the generated markdown is written to stdout on success. Redirect it to a file for use in agent tooling:

```bash
contenz skill > .cursor/skills/project-content-model/SKILL.md
```

With `--format json`, output matches `RunSkillResult`:

```json
{
  "success": true,
  "data": "---\nname: project-content-model\n..."
}
```

The generated skill describes each collection, its fields, relations, and the CLI commands agents should use (`create`, `update`, `view`, `list`, etc.) instead of hand-editing content files.
