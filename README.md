# content-tools

A CLI tool for validating and generating TypeScript data files from MDX/Markdown content with Zod schema validation.

## Features

- **Schema validation** - Validate content metadata against Zod schemas
- **i18n support** - Auto-detect locales from filenames (`{slug}.{locale}.mdx`)
- **Relation validation** - Validate cross-collection references
- **Multi-type collections** - Support multiple content types in one collection
- **Cascading configuration** - Project → Content → Collection level overrides
- **Coverage reports** - Generate translation coverage reports

## Installation

```bash
npm install
```

## Usage

```bash
# Validate all content
npm run content:lint

# Validate specific collection
npm run content:lint -- --collection faq

# Generate data files
npm run content:build
```

## Configuration

### Project Config (`/content.config.ts`)

```typescript
import type { ProjectConfig } from "content-tools";

export const config: ProjectConfig = {
  i18n: true,                                  // Enable locale detection
  strict: false,                               // Fail on warnings
  ignore: ["README.md", "_*"],                 // Patterns to ignore
  // contentDir: "content",                    // Default
  // outputDir: "generated/content",           // Default
  // coveragePath: "content.coverage.md",      // Default (in project root)
  // extensions: ["md", "mdx"],                // Default
};
```

### Collection Config (`content/*/config.ts`)

Only needed for multi-type collections or overrides:

```typescript
import type { CollectionConfig } from "content-tools";

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
- **`collection`** – shorter: `import { defineCollection as collection } from "content-tools"`.
- **`defineSchema`** – emphasizes schema; avoid if you already use a Zod helper with that name.

### Single-Type Collection (`content/faq/schema.ts`)

```typescript
import { z } from "zod";
import { defineCollection } from "content-tools";

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
import { defineMultiTypeCollection } from "content-tools";

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
├── content.coverage.md        # Coverage report (generated)
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
