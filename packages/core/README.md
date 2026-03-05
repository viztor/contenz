# @contenz/core

A CLI tool for validating and generating TypeScript data files from MDX/Markdown content with Zod schema validation. Part of the **@contenz** scope (npm and Git).

## Features

- **Schema validation** - Validate content metadata against Zod schemas
- **i18n support** - Auto-detect locales from filenames (`{slug}.{locale}.mdx`)
- **Relation validation** - Validate cross-collection references
- **Multi-type collections** - Support multiple content types in one collection
- **Cascading configuration** - Project → Content → Collection level overrides
- **Coverage reports** - Translation coverage summary in the console on every lint; use `--coverage` to write a markdown report file (e.g. `content.coverage.md`).

## Installation

```bash
npm install @contenz/core
```

## Usage

```bash
# Validate all content
contenz lint

# Validate specific collection
contenz lint --collection faq

# Write coverage report file (content.coverage.md)
contenz lint --coverage

# Generate data files
contenz build
```

If you add scripts to your app’s `package.json`:

```json
{
  "scripts": {
    "content:lint": "contenz lint",
    "content:build": "contenz build"
  }
}
```

Then: `npm run content:lint`, `npm run content:build`.

**Running without installing** (from project root):

- `npx contenz lint` / `npx contenz build`
- `pnpm exec contenz lint`
- `yarn dlx contenz lint` (or `yarn contenz lint` if installed)
- `bunx contenz lint`

**Monorepos / custom root:** use `--cwd` to set the project root (where `content.config.ts` lives):

```bash
contenz lint --cwd ../other-package
contenz build --cwd .
```

### Programmatic usage

You can run lint and build from Node scripts or build pipelines by importing from `@contenz/core/api`:

```typescript
import { runBuild, runLint, loadProjectConfig } from "@contenz/core/api";

// Load project config (content.config.ts or .mjs / .js)
const config = await loadProjectConfig(process.cwd());

// Run build; get report string and list of generated files
const buildResult = await runBuild({ cwd: process.cwd(), dir: "content" });
console.log(buildResult.report);
if (buildResult.success) {
  console.log("Generated:", buildResult.generated);
}

// Run lint; optionally write coverage report
const lintResult = await runLint({
  cwd: process.cwd(),
  dir: "content",
  coverage: true,
});
console.log(lintResult.report);
if (!lintResult.success) process.exit(1);
```

## Configuration

### Project Config (`content.config.ts` or `.mjs` / `.js`)

The CLI looks for project config in this order: `content.config.ts` → `content.config.mjs` → `content.config.js`. Use `.mjs` or `.js` if you want to avoid loading TypeScript for the config (e.g. in minimal CI).

```typescript
import type { ProjectConfig } from "@contenz/core";

export const config: ProjectConfig = {
  i18n: true,                                  // Enable locale detection
  strict: false,                               // Fail on warnings
  ignore: ["README.md", "_*"],                 // Patterns to ignore
  // contentDir: "content",                    // Default
  // outputDir: "generated/content",           // Default
  // coveragePath: "content.coverage.md",      // Default (used when running lint --coverage)
  // extensions: ["md", "mdx"],                // Default
};
```

### Collection Config (`content/*/config.ts`)

Only needed for multi-type collections or overrides:

```typescript
import type { CollectionConfig } from "@contenz/core";

export const config: CollectionConfig = {
  types: [
    { name: "topic", pattern: /^topic-/ },
    { name: "term", pattern: /.*/ },
  ],
};
```

## Schema Files and `defineCollection`

Use the **`defineCollection`** helper to define schemas and relations in one place. It returns a `SchemaModule`-compatible object (`meta`, `metaSchema`, and optional `relations`), so the CLI and generators work unchanged.

### Naming

The main export is **`defineCollection`**. You can alias it in your schema file if you prefer:

- **`defineCollection`** – explicit and consistent with common “defineX” patterns (recommended).
- **`collection`** – shorter: `import { defineCollection as collection } from "@contenz/core"`.
- **`defineSchema`** – emphasizes schema; avoid if you already use a Zod helper with that name.

### Single-Type Collection (`content/faq/schema.ts`)

```typescript
import { z } from "zod";
import { defineCollection } from "@contenz/core";

const schema = z.object({
  question: z.string().min(5),
  category: z.enum(["products", "ordering"]),
  relatedFaqs: z.array(z.string()).optional(),
});

export const { meta, metaSchema, relations } = defineCollection({
  schema,
  relations: { relatedFaqs: "faq" },
});

export type FAQMeta = z.infer<typeof meta>;
```

### Multi-Type Collection (`content/terms/schema.ts`)

```typescript
import { z } from "zod";
import { defineMultiTypeCollection } from "@contenz/core";

const termSchema = z.object({
  term: z.string(),
  relatedTerms: z.array(z.string()).optional(),
});

const topicSchema = z.object({
  topic: z.string(),
  featuredTerms: z.array(z.string()).optional(),
});

export const { termMeta, topicMeta, meta, relations } = defineMultiTypeCollection({
  schemas: { term: termSchema, topic: topicSchema },
  relations: { relatedTerms: "terms", featuredTerms: "terms" },
});

export type TermMeta = z.infer<typeof termMeta>;
export type TopicMeta = z.infer<typeof topicMeta>;
```

Use **`defineMultiTypeCollection`** for multi-type collections so TypeScript resolves the correct overload; you can also use **`defineCollection`** with a `schemas` object.

### Legacy style (still supported)

You can still export `meta` / `metaSchema` and `relations` manually; the CLI accepts both styles.

## File Structure

```
project-root/
├── content.config.ts          # Project config
├── content.coverage.md        # Coverage report (generated when running lint --coverage)
├── content/                   # Source content
│   ├── faq/
│   │   ├── schema.ts          # Zod schema
│   │   └── *.{locale}.mdx     # Content files
│   └── terms/
│       ├── schema.ts          # Multi-type schemas
│       ├── config.ts          # Multi-type config
│       └── *.{locale}.mdx
└── generated/
    └── content/               # Generated data files
        ├── index.ts           # Re-exports all collections
        ├── faq.ts             # FAQ data
        ├── news.ts            # News data
        └── terms.ts           # Terms data
```

## Filename Patterns

| i18n | Pattern | Example |
|------|---------|---------|
| `true` | `{slug}.{locale}.{ext}` | `moq.en.mdx` |
| `false` | `{slug}.{ext}` | `hello-world.mdx` |

## Generated Output

### With i18n (`data.ts`)

```typescript
export const faq: Record<string, FAQItem> = {
  "moq": {
    slug: "moq",
    locales: {
      en: { slug: "moq", file: "moq.en.mdx", question: "What is MOQ?", ... },
      zh: { slug: "moq", file: "moq.zh.mdx", question: "最低起订量是多少？", ... },
    },
  },
};
```

### Without i18n (`data.ts`)

```typescript
export const posts: Record<string, PostEntry> = {
  "hello-world": {
    slug: "hello-world",
    file: "hello-world.mdx",
    title: "Hello World",
    ...
  },
};
```

## Relation Validation

Relations validate that referenced slugs exist in target collections:

- **Non-existent slug** → ERROR
- **Self-reference** → WARNING
- **Circular reference** → INFO (allowed)

### Auto-Detection

Fields matching `related{Collection}` pattern are auto-detected:
- `relatedTerms` → validates against `terms` collection
- `relatedFaqs` → validates against `faq` collection

### Explicit Relations

For non-standard field names, export `relations`:

```typescript
export const relations = {
  featuredTerms: "terms",  // Not auto-detected
};
```

## Import Patterns

```typescript
// Import specific collection
import { faq } from "@/generated/content/faq";

// Import all collections
import { faq, news, terms } from "@/generated/content";

// Import schema types (still from content/)
import { termTopicLabels } from "@/content/terms/schema";
```
