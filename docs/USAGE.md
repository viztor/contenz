# Contenz Usage Guide

This guide describes every feature, command, and workflow for Contenz — a schema-first, AI-native content management CLI.

For reference-level details see:
- [CLI reference](./CLI.md) — all commands with options tables
- [API reference](./API.md) — programmatic API (`@contenz/core/api`)
- [Configuration](./CONFIGURATION.md) — project and collection config, schemas
- [Content model](./CONTENT-MODEL.md) — filenames, output shape, relations, i18n
- [Architecture](./ARCHITECTURE.md) — packages and pipeline

---

## 1. Installation

Install the CLI and core library:

```bash
# CLI (for commands)
npm install -D @contenz/cli

# Core (for schema/config files)
npm install @contenz/core zod
```

`@contenz/cli` provides the `contenz` binary. `@contenz/core` provides schema helpers like `defineCollection` plus the `zod` peer dependency.

---

## 2. Project initialization

### New project setup

```bash
contenz init
```

This creates:
- `contenz.config.ts` — project configuration
- `content/pages/schema.ts` — starter collection schema
- `content/pages/welcome.json` — sample content file

### Options

```bash
contenz init --i18n                    # Enable i18n (creates en + zh sample files)
contenz init --collection blog         # Custom collection name
contenz init --dir src/content         # Custom content directory
contenz init --cwd ../existing-app     # Initialize in another directory
contenz init --force                   # Overwrite existing files
```

### After init

```bash
contenz lint   # Validate content against schema
contenz build  # Generate typed output files
```

---

## 3. Content authoring

### File structure

```
project-root/
├── contenz.config.ts          # Project config
├── content/
│   ├── faq/
│   │   ├── schema.ts          # Collection schema
│   │   ├── config.ts          # Optional collection overrides
│   │   ├── hello.mdx          # Content file (no i18n)
│   │   ├── moq.en.mdx         # Content file (i18n: English)
│   │   └── moq.zh.mdx         # Content file (i18n: Chinese)
│   └── blog/
│       ├── schema.ts
│       └── hello-world.md
└── generated/
    └── content/               # Generated output (by `contenz build`)
        ├── index.ts
        ├── faq.ts
        └── blog.ts
```

### Filename patterns

| i18n | Pattern | Example |
|------|---------|---------|
| `false` | `{slug}.{ext}` | `hello-world.mdx`, `faq.md` |
| `true` | `{slug}.{locale}.{ext}` | `moq.en.mdx`, `intro.zh.md` |

Supported extensions: `md`, `mdx`, `json` (default). MD/MDX require `@contenz/adapter-mdx` to be registered; JSON is built-in.

### Metadata formats

**MDX** (`export const meta`):
```mdx
export const meta = {
  title: "Welcome",
  category: "general",
};

Your content body goes here.
```

**Markdown** (frontmatter):
```md
---
title: Welcome
category: general
---

Your content body goes here.
```

**JSON** (pure data, no body):
```json
{
  "title": "Welcome",
  "category": "general"
}
```

### Schema authoring

Define validation schemas in `schema.ts` using Zod:

```ts
import { defineCollection } from "@contenz/core";
import { z } from "zod";

const schema = z.object({
  title: z.string(),
  summary: z.string().optional(),
  category: z.enum(["products", "ordering", "support"]),
  tags: z.array(z.string()).default([]),
});

export const { meta, relations } = defineCollection({ schema });
```

For multi-type collections (e.g. terms + topics):

```ts
import { defineMultiTypeCollection } from "@contenz/core";
import { z } from "zod";

export const { termMeta, topicMeta, meta, relations, types } = defineMultiTypeCollection({
  schemas: {
    topic: { schema: z.object({ title: z.string() }), pattern: /^topic-/ },
    term: { schema: z.object({ term: z.string() }), pattern: /.*/ },
  },
});
```

### Relations

Validate that slugs in relation fields exist in target collections:

```ts
// Auto-detected: `relatedTerms` → `terms`, `relatedFaqs` → `faq`
// Explicit:
export const relations = {
  featuredTerms: "terms",
};
```

---

## 4. Validation

### Basic validation

```bash
contenz lint                      # Validate all collections
contenz lint --collection faq     # Validate one collection
```

### Coverage reporting

```bash
contenz lint --coverage           # Write coverage report (contenz.coverage.md)
contenz lint --coverage --dry-run # Preview without writing
```

### Output formats

```bash
contenz lint --format pretty      # Human-readable (default)
contenz lint --format json        # Machine-readable JSON
contenz lint --format github      # GitHub Actions annotations
```

### CI integration

```yaml
# .github/workflows/content.yml
- run: contenz lint --format github
- run: contenz build --format github
```

---

## 5. Building

### Generate typed output

```bash
contenz build                # Incremental build (skip unchanged)
contenz build --force        # Full rebuild
contenz build --dry-run      # Preview without writing
```

Output goes to `generated/content/` (configurable via `outputDir`).

### Generated output shape

Without i18n:
```ts
export const faq = {
  hello: {
    slug: "hello",
    file: "hello.mdx",
    question: "What is contenz?",
    category: "products",
  },
};
```

With i18n:
```ts
export const faq = {
  moq: {
    slug: "moq",
    locales: {
      en: { slug: "moq", file: "moq.en.mdx", question: "What is MOQ?" },
      zh: { slug: "moq", file: "moq.zh.mdx", question: "最低起订量是多少？" },
    },
  },
};
```

### Using generated content in your app

```ts
import { faq } from "@/generated/content/faq";
import { faq, blog } from "@/generated/content";

// Access content
const item = faq["hello"];
console.log(item.question);
```

### Watch mode

```bash
contenz watch               # Rebuild on file change
```

### Build status

```bash
contenz status              # Exit 0 if up to date, 1 if build needed
```

---

## 6. AI-native content management

These commands form the bidirectional API for AI agents, scripts, and automation. They default to `--format json` for machine consumption.

### Discover collections and schemas

```bash
# List all collections
contenz list

# List items in a collection
contenz list faq

# Introspect a collection's schema (fields, types, required/optional)
contenz schema faq
contenz schema terms --type term    # For multi-type collections
```

### Read content

```bash
# View a single item
contenz view faq hello
contenz view faq moq --locale zh

# Search by slug substring
contenz search faq hello

# Search by field value
contenz search faq --field category=products

# Combined: slug + field + locale
contenz search faq moq --field category=ordering --locale en --limit 10
```

### Create content

```bash
# Create a new item (validates against schema)
contenz create faq new-item --set question="What is Contenz?" --set category=products

# Create with locale
contenz create faq new-item --locale zh --set question="Contenz是什么？" --set category=products

# Create in multi-type collection
contenz create terms glossary-item --type term --set term="API"
```

Schema defaults are automatically applied. Missing required fields cause validation failure.

### Update content

```bash
# Update existing fields
contenz update faq hello --set question="Updated question?"

# Remove optional fields
contenz update faq hello --unset deprecated

# Multiple mutations
contenz update faq hello --set question="New?" --set category=ordering --unset oldField

# Update specific locale
contenz update faq moq --locale zh --set question="更新了"
```

The merged metadata is validated against the schema before writing.

### AI agent workflow

An AI agent can safely manage content using this sequence:

```bash
# 1. Discover the project structure
contenz list --format json

# 2. Understand the schema
contenz schema faq --format json

# 3. Read existing content
contenz view faq hello --format json

# 4. Search for related items
contenz search faq --field category=products --format json

# 5. Create new content
contenz create faq new-item \
  --set question="What is new?" \
  --set category=products \
  --format json

# 6. Update content
contenz update faq hello \
  --set question="Updated question" \
  --format json

# 7. Validate everything
contenz lint --format json
```

All commands return a consistent JSON envelope:

```json
{
  "success": true,
  "data": { ... },
  "error": "...",
  "diagnostics": [{ "field": "...", "message": "..." }]
}
```

---

## 7. Programmatic API

Import from `@contenz/core/api` for scripting and tooling:

```ts
import {
  runBuild, runLint, runStatus,
  runList, runView, runCreate, runUpdate, runSearch, runSchema,
  createWorkspace,
} from "@contenz/core/api";

const cwd = process.cwd();

// Build pipeline
const lintResult = await runLint({ cwd, coverage: true });
const buildResult = await runBuild({ cwd });

// Content operations
const schema = await runSchema({ cwd, collection: "faq" });
const item = await runView({ cwd, collection: "faq", slug: "hello" });
const results = await runSearch({ cwd, collection: "faq", fields: { category: "products" } });
```

For schema files, import from `@contenz/core` (the default entry):

```ts
import { defineCollection, defineMultiTypeCollection } from "@contenz/core";
import type { ContenzConfig, CollectionConfig } from "@contenz/core";
```

See [API reference](./API.md) for the complete list of exports and types.

---

## 8. Configuration reference

### Project config (`contenz.config.ts`)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sources` | `string[]` | `["content/*"]` | Source patterns for collection discovery |
| `outputDir` | `string` | `"generated/content"` | Generated output directory |
| `i18n` | `boolean \| I18nConfigShape` | `false` | Enable locale detection |
| `extensions` | `string[]` | `["md", "mdx", "json"]` | Allowed file extensions |
| `ignore` | `string[]` | `["README.md", "_*"]` | Patterns to ignore |
| `strict` | `boolean` | `false` | Fail on warnings |
| `coveragePath` | `string` | `"contenz.coverage.md"` | Coverage report path |
| `adapters` | `FormatAdapter[]` | `[]` | Format adapters for content parsing. Register `@contenz/adapter-mdx` for MD/MDX support. JSON is built-in. |
| `collections` | `Record<string, CollectionDeclaration>` | `undefined` | Inline collection declarations with schemas. See [Configuration – Centralized collections](./CONFIGURATION.md#centralized-collections). |

### Collection config (`content/<collection>/config.ts`)

| Option | Type | Description |
|--------|------|-------------|
| `types` | `ContentType[]` | Multi-type: `{ name, pattern }` |
| `slugPattern` | `RegExp` | Custom slug extraction regex |
| `i18n` | `boolean \| I18nConfigShape` | Override project i18n |
| `extensions` | `string[]` | Override allowed extensions |
| `ignore` | `string[]` | Override ignore patterns |

### i18n configuration

```ts
i18n: {
  enabled: true,
  defaultLocale: "en",
  locales: ["en", "zh"],
  fallback: { "zh-Hant": "zh", "zh": "en" },
  coverageThreshold: 0.8,
  detectStale: true,
  includeFallbackMetadata: false,
}
```

See [Configuration](./CONFIGURATION.md) for full details.

---

## 9. Common commands cheat sheet

| Task | Command |
|------|---------|
| Initialize project | `contenz init` |
| Validate content | `contenz lint` |
| Generate TypeScript | `contenz build` |
| Watch for changes | `contenz watch` |
| Check build status | `contenz status` |
| List collections | `contenz list` |
| View an item | `contenz view <collection> <slug>` |
| Create an item | `contenz create <collection> <slug> --set key=value` |
| Update an item | `contenz update <collection> <slug> --set key=value` |
| Search items | `contenz search <collection> [query] [--field key=value]` |
| Introspect schema | `contenz schema <collection>` |
