---
name: contenz
description: Manage content in a Contenz project — create, update, translate, validate, and build schema-first content. Use this skill whenever the user mentions contenz, content collections, content schemas, content translation, locale management, i18n pipelines, MDX/markdown content files, content generation, or wants to automate multilingual content workflows. Also triggers for tasks involving content CRUD via CLI, setting up translation coverage, or building typed content outputs.
---

# Contenz — AI Content Management Skill

Contenz is a schema-first, AI-native content management CLI. Content lives in the repo as files (MDX, MD, JSON); schemas are Zod objects; the CLI validates, builds typed outputs, and exposes a bidirectional JSON API for safe content operations.

This skill teaches you how to operate on a Contenz project. For exhaustive option tables and edge cases, read the built-in docs directly — they are the source of truth:

| Doc                  | Path                                                | What it covers                                       |
| -------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| CLI reference        | `docs/CLI.md`                                       | Every command, every flag, output shapes             |
| Usage guide          | `docs/USAGE.md`                                     | End-to-end workflows with examples                   |
| Configuration        | `docs/CONFIGURATION.md`                             | Project config, collection config, schemas, adapters |
| Content model        | `docs/CONTENT-MODEL.md`                             | Filenames, i18n, output shape, relations             |
| API reference        | `docs/API.md`                                       | Programmatic `@contenz/core/api` exports             |
| Architecture         | `docs/ARCHITECTURE.md`                              | Package layout, data flow, invariants                |
| Translation pipeline | `skills/contenz/references/translation-pipeline.md` | Batch translation, CI, staleness, programmatic API   |

> Read the relevant doc file with `view_file` before doing anything non-trivial. These docs are short and well-structured — a 30-second read beats guessing.

---

## 1. Project discovery

Before modifying content, always orient yourself in the project:

```bash
# What collections exist?
contenz list --format json

# What fields does a collection expect?
contenz schema <collection> --format json

# For multi-type collections, introspect a specific type:
contenz schema <collection> --type <type> --format json
```

The `schema` command returns field names, types, required/optional, enum values, and defaults. This is the single most important command — always run it before `create` or `update`.

If i18n is enabled, `contenz list <collection>` returns items with their locale. You can tell i18n is active when the project config has `i18n: true` or an `I18nConfigShape` object. Check `contenz.config.ts` directly if unsure.

---

## 2. Reading content

```bash
# View a single item (full metadata + body)
contenz view <collection> <slug> --format json

# View a specific locale
contenz view <collection> <slug> --locale zh --format json

# Search by slug substring
contenz search <collection> <query> --format json

# Search by field value
contenz search <collection> --field category=products --format json

# Combined filters
contenz search <collection> <query> --field key=value --locale en --limit 20 --format json
```

All commands return a consistent JSON envelope: `{ success, data, error?, diagnostics? }`.

---

## 3. Creating content

```bash
# Basic creation
contenz create <collection> <slug> --set key=value --set key2=value2 --format json

# With locale (required when i18n is enabled)
contenz create <collection> <slug> --locale en --set title="Hello" --format json

# Multi-type collection
contenz create <collection> <slug> --type term --set term="API" --format json
```

The `--set` flag is repeatable. Values are parsed as JSON when possible, otherwise treated as strings. Schema defaults are auto-applied. If required fields are missing, the command fails with diagnostics.

**Pre-flight checklist:**

1. Run `contenz schema <collection>` to know the required fields
2. If i18n is enabled, always pass `--locale`
3. If multi-type, always pass `--type`

---

## 4. Updating content

```bash
# Update fields (preserves body and untouched fields)
contenz update <collection> <slug> --set question="Updated?" --format json

# Remove optional fields
contenz update <collection> <slug> --unset deprecated --format json

# Update a specific locale
contenz update <collection> <slug> --locale zh --set question="更新了" --format json

# Combine set and unset
contenz update <collection> <slug> --set title="New" --unset oldField --format json
```

The merged metadata is validated against the schema before writing. At least one `--set` or `--unset` is required.

---

## 5. Validation and build

```bash
# Validate everything
contenz lint --format json

# Validate one collection
contenz lint --collection <name> --format json

# Generate typed outputs (incremental)
contenz build --format json

# Force full rebuild
contenz build --force

# Check if build is current
contenz status
```

After creating or updating content, **always run `contenz lint`** to catch schema violations, missing relations, and i18n coverage gaps.

---

## 6. Translation pipeline

This is the main workflow for automating translations across an i18n-enabled Contenz project. For batch automation, CI integration, staleness management, and programmatic API examples, read `references/translation-pipeline.md`.

### Prerequisites

The project must have i18n enabled in `contenz.config.ts`:

```ts
// Minimal
i18n: true

// Full control
i18n: {
  enabled: true,
  defaultLocale: "en",
  locales: ["en", "zh", "ja"],
  fallback: { "zh": "en", "ja": "en" },
  coverageThreshold: 0.8,
  detectStale: true,
}
```

Read `docs/CONTENT-MODEL.md` §Internationalization for the full config shape.

### Step-by-step: translate a collection

#### Step 1 — Discover what needs translating

```bash
# List all items in the collection to see which locales exist
contenz list <collection> --format json

# Run lint with coverage to get a translation coverage report
contenz lint --coverage --format json
```

The coverage report (`contenz.coverage.md` by default) shows per-locale, per-slug completeness and flags stale translations when `detectStale` is on.

#### Step 2 — Read the source content

For each slug that needs translation, read the source locale:

```bash
contenz view <collection> <slug> --locale en --format json
```

This gives you the full `meta` object and `body` text to translate.

#### Step 3 — Create the translated version

```bash
contenz create <collection> <slug> --locale <target> \
  --set field1="translated value" \
  --set field2="translated value" \
  --format json
```

For content with a body (MDX/MD files), you'll need to write the file directly since `contenz create` sets metadata only. The file will be created at `content/<collection>/<slug>.<locale>.<ext>`.

#### Step 4 — Validate

```bash
contenz lint --collection <collection> --format json
contenz lint --coverage
```

Check that all locales pass validation and coverage meets the threshold.

### Batch translation workflow

For translating an entire collection to a new locale:

```bash
# 1. Get the schema
SCHEMA=$(contenz schema <collection> --format json)

# 2. List all items
ITEMS=$(contenz list <collection> --format json)

# 3. For each slug, read source → translate → create target
#    Parse the JSON output to iterate over items
contenz view <collection> <slug> --locale en --format json
# ... translate the meta fields ...
contenz create <collection> <slug> --locale <target> --set field="翻译" --format json

# 4. Validate everything
contenz lint --coverage --format json

# 5. Rebuild
contenz build --force
```

### Writing translated files with body content

When content has a body (MDX/MD), `contenz create` writes the metadata but the body will be empty. To create a fully translated file including body content, write the file directly:

**For MDX/MD with frontmatter:**

```
---
title: 翻译标题
category: products
---

翻译的正文内容。
```

Save to: `content/<collection>/<slug>.<locale>.mdx`

**For JSON (no body):**

```json
{ "title": "翻译标题", "category": "products" }
```

Save to: `content/<collection>/<slug>.<locale>.json`

After writing files directly, run `contenz lint` to validate them against the schema.

### Filename convention

| i18n    | Pattern                 | Example      |
| ------- | ----------------------- | ------------ |
| `true`  | `{slug}.{locale}.{ext}` | `moq.zh.mdx` |
| `false` | `{slug}.{ext}`          | `hello.mdx`  |

The locale is embedded in the filename. This is how Contenz discovers which locale a file belongs to.

---

## 7. Project setup (from scratch)

```bash
# Install
npm install -D @contenz/cli
npm install @contenz/core zod

# For MD/MDX support
npm install @contenz/adapter-mdx

# Scaffold
contenz init              # basic
contenz init --i18n       # with i18n enabled
contenz init --collection blog --dir src/content
```

After init, register the MDX adapter in `contenz.config.ts` if using markdown:

```ts
import { mdxAdapter } from "@contenz/adapter-mdx";
import type { ContenzConfig } from "@contenz/core";

export const config: ContenzConfig = {
  adapters: [mdxAdapter],
  i18n: true,
};
```

Read `docs/CONFIGURATION.md` for the full config reference.

---

## 8. Programmatic API

For scripting beyond what the CLI offers, use `@contenz/core/api`:

```ts
import {
  runList,
  runView,
  runCreate,
  runUpdate,
  runSearch,
  runSchema,
  runLint,
  runBuild,
} from "@contenz/core/api";
```

Every function mirrors its CLI counterpart. Read `docs/API.md` for the complete type signatures.

---

## 9. Common patterns

### Check if a slug exists before creating

```bash
contenz view <collection> <slug> --locale en --format json
# If success: false → create it
# If success: true → update it instead
```

### CI validation

```yaml
# .github/workflows/content.yml
- run: contenz lint --format github
- run: contenz build --format github
```

### Watch mode for local development

```bash
contenz watch
```

Rebuilds on every content/config change.

---

## Quick reference

| Task              | Command                                             |
| ----------------- | --------------------------------------------------- |
| List collections  | `contenz list`                                      |
| List items        | `contenz list <collection>`                         |
| Introspect schema | `contenz schema <collection>`                       |
| View item         | `contenz view <collection> <slug>`                  |
| Create item       | `contenz create <collection> <slug> --set k=v`      |
| Update item       | `contenz update <collection> <slug> --set k=v`      |
| Search            | `contenz search <collection> [query] [--field k=v]` |
| Validate          | `contenz lint`                                      |
| Build             | `contenz build`                                     |
| Coverage report   | `contenz lint --coverage`                           |
| Watch             | `contenz watch`                                     |
| Build status      | `contenz status`                                    |
