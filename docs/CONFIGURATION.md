---
tags:
  - docs
  - contenz
status: note
---

# Configuration

Contenz is configured at two levels: **project** (root) and **collection** (per collection). This document covers both and how to author schemas.

## Project config

Create `contenz.config.ts` (or `contenz.config.mjs` / `contenz.config.js`) in the project root. The loader also accepts legacy `content.config.*` as a fallback.

```ts
import type { ContenzConfig } from "@contenz/core";

export const config: ContenzConfig = {
  sources: ["content/*"],
  outputDir: "generated/content",
  coveragePath: "contenz.coverage.md",
  strict: false,
  i18n: false,
  extensions: ["md", "mdx", "json"],
  ignore: ["README.md", "_*"],
};
```

Contenz supports two collection discovery modes that can be used **independently or together**:

1. **Filesystem discovery** (default) — collections are auto-discovered from `sources` patterns by finding `schema.ts` files
2. **Centralized declaration** — collections are declared inline via the `collections` field with schemas provided directly

### Options

| Option         | Type                                    | Default                 | Description                                                                                                                  |
| -------------- | --------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `sources`      | `string[]`                              | `["content/*"]`         | Discovery patterns. `content/*` = direct child folders. `docs` = treat `docs/` as one collection.                            |
| `collections`  | `Record<string, CollectionDeclaration>` | `undefined`             | Inline collection declarations — see [Centralized collections](#centralized-collections) below.                              |
| `outputDir`    | `string`                                | `"generated/content"`   | Directory for generated TypeScript files.                                                                                    |
| `coveragePath` | `string`                                | `"contenz.coverage.md"` | Path for the lint coverage report.                                                                                           |
| `strict`       | `boolean`                               | `false`                 | If true, fail build/lint on warnings (e.g. missing translations).                                                            |
| `i18n`         | `boolean \| I18nConfigShape`            | `false`                 | Enable locale detection from filenames. See [[CONTENT-MODEL#internationalization                                             | Content model – i18n]]. |
| `extensions`   | `string[]`                              | `["md", "mdx", "json"]` | Allowed content file extensions.                                                                                             |
| `ignore`       | `string[]`                              | `["README.md", "_*"]`   | Glob patterns to ignore under each collection.                                                                               |
| `adapters`     | `FormatAdapter[]`                       | `[]`                    | Format adapters for content file parsing. Register adapters for `.md`/`.mdx` (via `@contenz/adapter-mdx`). JSON is built-in. |
| `hooks`        | `object`                                | `undefined`             | Extension hooks for tapping into the build lifecycle (`beforeBuild`, `transformItem`, `afterBuild`).                         |
| `contentDir`   | `string`                                | _(deprecated)_          | Use `sources: ["<contentDir>/*"]` instead.                                                                                   |

### i18n config shape

`i18n` accepts a boolean or a rich object:

```ts
import type { ContenzConfig } from "@contenz/core";

export const config: ContenzConfig = {
  i18n: {
    enabled: true,
    defaultLocale: "en",
    locales: ["en", "zh-CN", "zh-TW"],
    // Locale fallback chains — see [Fallback chains](#fallback-chains)
    fallback: {
      "zh-TW": ["zh-CN", "en"],
      "zh-CN": "en",
    },
    coverageThreshold: 0.8,
    detectStale: true,
    includeFallbackMetadata: false,
    outputStrategy: "merged", // or "split"
  },
};
```

| Field                     | Type                                             | Default      | Description                                                                                                                                                  |
| ------------------------- | ------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `enabled`                 | `boolean`                                        | `false`      | Master switch. `i18n: true` is shorthand for `{ enabled: true }`.                                                                                            |
| `defaultLocale`           | `string`                                         | `null`       | Source locale for staleness checks and the default for content ops.                                                                                          |
| `locales`                 | `string[]`                                       | _(inferred)_ | Declared locale list. When present, `lint --translations` checks every slug against it and undeclared detected locales are reported. Duplicates are removed. |
| `fallback`                | `Record<string, string \| string[]> \| string[]` | `{}`         | Fallback chains — see below.                                                                                                                                 |
| `coverageThreshold`       | `number` (0–1)                                   | `null`       | Warn (or error with `strict`) when full-translation coverage falls below this ratio. Values outside 0–1 are rejected.                                        |
| `detectStale`             | `boolean`                                        | `false`      | Emit `I18N_STALE_TRANSLATION` when a translation file's mtime is older than the default-locale source.                                                       |
| `includeFallbackMetadata` | `boolean`                                        | `false`      | Emit `_fallback: "<locale>"` on generated entries served by a fallback locale.                                                                               |
| `outputStrategy`          | `"merged" \| "split"`                            | `"merged"`   | `merged` = one file per collection with a `locales` map. `split` = per-locale files + `locale()` async resolver.                                             |

#### Fallback chains

`fallback` maps a locale to an **ordered** chain of fallback locales. The first locale in the chain that has content wins (max depth 5; cycles are guarded):

```ts
i18n: {
  enabled: true,
  fallback: {
    "zh-TW": ["zh-CN", "en"], // zh-TW → zh-CN → en
    de: "en",                 // string shorthand for a single-step chain
  },
}
```

A top-level **array** sets a global default chain for every locale without a specific one:

```ts
i18n: { enabled: true, fallback: ["en"] } // every locale falls back to en
```

Resolution rules (implemented once in `@contenz/core` and shared by merged output, split output, and the generated `_locale.ts` resolver):

- Direct hit → use it; no `_fallback` metadata.
- Missing → walk the chain in order; the first locale with content is used.
- Locales with a specific chain **do not** inherit the global default chain.
- `_fallback` provenance is always computed; it is only **emitted** when `includeFallbackMetadata: true`.

### Centralized collections

Instead of (or in addition to) filesystem discovery, declare collections inline:

```ts
import { z } from "zod";
import type { ContenzConfig } from "@contenz/core";

export const config: ContenzConfig = {
  collections: {
    faq: {
      path: "content/faq",
      schema: z.object({
        question: z.string(),
        category: z.enum(["products", "ordering"]),
      }),
    },
    blog: {
      path: "content/blog",
      schema: z.object({
        title: z.string(),
        tags: z.array(z.string()).default([]),
      }),
      relations: { faqLinks: "faq" },
    },
  },
};
```

Each entry in `collections` is a `CollectionDeclaration`:

| Field       | Type               | Required | Description                                                                |
| ----------- | ------------------ | -------- | -------------------------------------------------------------------------- |
| `path`      | `string`           | ✅       | Directory containing content files (relative to project root).             |
| `schema`    | `ZodSchema`        | ❌       | Inline Zod schema. If omitted, falls back to `schema.ts` in the directory. |
| `relations` | `Relations`        | ❌       | Relation mapping for this collection.                                      |
| `config`    | `CollectionConfig` | ❌       | Collection-level config overrides (`types`, `extensions`, `i18n`, etc.).   |

**Precedence rules:**

- If `collections.faq` is declared **and** `content/faq/schema.ts` exists, the inline `schema` wins.
- If `sources` discovers a collection with the same name as a `collections` entry, the inline declaration wins.
- You can mix both: use `sources` for auto-discovered collections and `collections` for others.
- If neither `sources` nor `collections` is set, the default `sources: ["content/*"]` applies.

## Collection config

Use `content/<collection>/config.ts` only when a collection needs overrides. For example, multi-type collections or a custom slug pattern.

```ts
import type { CollectionConfig } from "@contenz/core";

export const config: CollectionConfig = {
  types: [
    { name: "topic", pattern: /^topic-/ },
    { name: "term", pattern: /.*/ },
  ],
  slugPattern: /^(.+)\.(\w+)\.(mdx?)$/, // optional
  i18n: true, // override project i18n for this collection
  extensions: ["mdx"],
  ignore: ["_drafts/*"],
};
```

### Options

| Option        | Type                         | Description                                                                                                                                                                          |
| ------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `types`       | `ContentType[]`              | Multi-type collection: `{ name, pattern }`. First matching pattern wins. **Optional** when the schema exports `types` (see [Schema authoring – Multi-type](#multi-type-collection)). |
| `slugPattern` | `RegExp`                     | Custom regex to extract slug (and optionally locale) from filename.                                                                                                                  |
| `i18n`        | `boolean \| I18nConfigShape` | Override i18n for this collection.                                                                                                                                                   |
| `extensions`  | `string[]`                   | Override allowed extensions.                                                                                                                                                         |
| `ignore`      | `string[]`                   | Override ignore patterns.                                                                                                                                                            |

## Schema authoring

Each collection can have a `schema.ts` that exports a Zod schema and optionally relations.

### Single-type collection

```ts
import { defineCollection } from "@contenz/core";
import { z } from "zod";

const schema = z.object({
  question: z.string(),
  category: z.enum(["products", "ordering"]),
});

export const { meta, relations, computed } = defineCollection({
  schema,
  // Optional: override the generated interface name (default: FaqMeta for a "faq" collection)
  metaTypeName: "FaqEntry",
  computed: {
    readingTime: (item) => Math.ceil((item.body || "").split(" ").length / 200),
    permalink: (item) => `/faq/${item.slug}`,
  },
});
```

- `meta` is the Zod schema used for validation and generation.
- `relations` defines which fields reference other collections. Field names are user-defined — use any name that matches your schema.
- `computed` allows you to derive properties at build time (e.g. `readingTime`) dynamically before schema validation occurs.
- `metaTypeName` overrides the generated meta interface name; by default it is derived from the collection directory name (`faq` → `FaqMeta`).

### Multi-type collection

When the collection has multiple content types (e.g. terms and topics), use `defineMultiTypeCollection` and export one schema per type. You can define **either** in the schema **or** in the collection config:

**Option A – Types and patterns in the schema (single source of truth)**  
Pass `{ schema, pattern }` per type so the schema module also exports `types`. You can omit `config.types` in `config.ts`:

```ts
import { defineMultiTypeCollection } from "@contenz/core";
import { z } from "zod";

const termSchema = z.object({
  term: z.string(),
  definition: z.string().optional(),
});

const topicSchema = z.object({
  title: z.string(),
  summary: z.string().optional(),
});

export const { termMeta, topicMeta, meta, relations, types } =
  defineMultiTypeCollection({
    schemas: {
      topic: { schema: topicSchema, pattern: /^topic-/ },
      term: { schema: termSchema, pattern: /.*/ },
    },
  });
```

Filenames are matched against `pattern` in order (object key order); first match wins. The schema module’s exported `types` are used when the collection config does not set `types`.

**Authoring errors** — `defineMultiTypeCollection` throws at load time when:

- `schemas` is empty (no content types declared), or
- two types declare the same pattern source — the second type could never match since first match wins.

**Option B – Patterns in collection config**  
Use plain schemas and set `config.types` in `content/<collection>/config.ts`:

```ts
// schema.ts
export const { termMeta, topicMeta, meta, relations } =
  defineMultiTypeCollection({
    schemas: { term: termSchema, topic: topicSchema },
  });

// config.ts
export const config: CollectionConfig = {
  types: [
    { name: "topic", pattern: /^topic-/ },
    { name: "term", pattern: /.*/ },
  ],
};
```

If both schema and config define types, **config.types wins** (config overrides).

### Relations

Fields that reference other collections can be validated so slugs exist in the target collection. Define relations explicitly in `defineCollection()` using any field name:

```ts
export const { meta, relations } = defineCollection({
  schema,
  relations: {
    glossaryLinks: "glossary", // any field name → target collection
    authorRef: "team",
    seeAlso: "faq",
  },
});
```

> **Deprecated:** Auto-detection of `related{Collection}` field names (e.g. `relatedTerms` → `terms`) is deprecated. Use explicit `relations` instead.

See [[CONTENT-MODEL#relation-validation|Content model – Relations]] for validation rules.

## Source discovery rules

- `sources: ["content/*"]` discovers only **direct** child folders of `content/`: `content/faq`, `content/blog`, etc. It does not recurse into `content/faq/en/`.
- `sources: ["docs"]` treats the `docs/` directory itself as one collection (no `docs/something` sub-collections).
- The default when `sources` is omitted is `["content/*"]`.
- Collection names are derived from the folder name (e.g. `content/faq` → collection `faq`).

## Loading order

1. Project config: `contenz.config.ts` (or `.mjs` / `.js`).
2. Inline collections from `config.collections` are pre-declared (schema provided directly).
3. Filesystem discovery via `sources` patterns finds `schema.ts` files.
4. If a collection exists in both `collections` and filesystem, the inline declaration wins.
5. Collection config: `content/<collection>/config.ts` (if present) is merged.
6. Resolved config merges project and collection; collection overrides project for the fields it defines.
7. Schema: `schema.ts` or inline `schema` is loaded when validating or building.

## Format adapters

Contenz uses format adapters to parse and serialize content files. JSON is built-in. For MD/MDX files, register `@contenz/adapter-mdx`:

```ts
import { mdxAdapter } from "@contenz/adapter-mdx";
import type { ContenzConfig } from "@contenz/core";

export const config: ContenzConfig = {
  adapters: [mdxAdapter],
};
```

The MDX adapter handles both `.md` and `.mdx` files with **dual syntax support**:

- **Frontmatter** (`---` YAML / JSON / JSON-ish YAML `---`) — works in both `.md` and `.mdx` files. Multiline arrays and objects, trailing commas, dash lists, and indented maps are supported.
- **Export syntax** (`export const meta = { ... }`) — MDX-specific

When both are present, frontmatter takes precedence.

For filename patterns and generated output shape see [[CONTENT-MODEL|Content model]].
