# Content model

This document describes how Contenz treats filenames, generated output, relations, and i18n.

## Filename patterns

Content files live under each collection directory. The parser infers **slug** and (when i18n is enabled) **locale** from the filename.

| i18n | Pattern | Example |
|------|---------|---------|
| `false` | `{slug}.{ext}` | `hello-world.mdx`, `faq.mdx` |
| `true` | `{slug}.{locale}.{ext}` | `moq.en.mdx`, `intro.zh.mdx` |

- **ext**: From config `extensions` (default `md`, `mdx`).
- **slug**: Used as the document key in generated output and in URLs (e.g. Studio doc view).
- **locale**: Only used when project or collection config has `i18n` enabled. Affects generated shape and coverage.

Custom extraction is possible via collection `config.slugPattern` (RegExp).

## File structure

Each content file can be:

- **Markdown/MDX with frontmatter**: metadata in YAML frontmatter, body after the first `---`.
- **MDX with export**: `export const meta = { ... };` plus body. Supported for MDX; frontmatter is the more common pattern.

The parser produces:

- `meta`: key-value metadata (validated against the collection schema).
- `body`: content after the meta block (raw string).
- `slug`, `locale`: from filename (and optional `slugPattern`).

## Generated output shape

Generated files are written to `outputDir` (default `generated/content/`). One TypeScript file per collection (e.g. `faq.ts`, `terms.ts`).

### Without i18n

Each slug maps to one entry with `slug`, `file`, and schema fields:

```ts
export const faq = {
  "hello-world": {
    slug: "hello-world",
    file: "hello-world.mdx",
    question: "What is contenz?",
    category: "products",
  },
};
```

### With i18n

Each slug has a `locales` map; each locale has `file` and the schema fields for that locale:

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

Optional `includeFallbackMetadata` in i18n config can add a `_fallback` flag when the value came from a fallback locale.

### Index

When using the default source layout, an `index.ts` may re-export all collections so you can import from one place:

```ts
import { faq, terms } from "@/generated/content";
// or
import { faq } from "@/generated/content/faq";
```

## Relation validation

Fields that reference other collections (e.g. slugs in `relatedTerms`) can be validated so that each slug exists in the target collection.

- **Auto-detected**: `related{Collection}` → target collection name (e.g. `relatedTerms` → `terms`, `relatedFaqs` → `faq`).
- **Explicit**: Export `relations` from the schema module: `{ featuredTerms: "terms" }`.

Validation behavior:

- **Missing target slug**: Error.
- **Self-reference** (e.g. FAQ linking to same collection): Warning.
- **Circular reference**: Informational.

Relation checks run during `contenz lint` and (when validation is enabled) during build.

## Internationalization

Enable with `i18n: true` or a rich `I18nConfigShape` in project or collection config:

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

- **defaultLocale**: Used as source for staleness and as fallback when no locale is specified.
- **locales**: Optional explicit list; if omitted, locales are inferred from filenames.
- **fallback**: Record (locale → fallback locale) or array for a single global fallback.
- **coverageThreshold**: Minimum ratio (0–1) before coverage warnings.
- **detectStale**: Emit diagnostics when a translation file is older than the default-locale source.
- **includeFallbackMetadata**: Add `_fallback` in generated output when value came from fallback.

Lint with `--coverage` writes a coverage report (e.g. `contenz.coverage.md`) showing per-locale and per-slug coverage and staleness when applicable.

## Multi-type collections

When a collection uses multiple content types (e.g. terms and topics):

- **Config**: Optionally set `config.types` with `{ name, pattern }` in `config.ts`. If the schema defines types (via `defineMultiTypeCollection` with `{ schema, pattern }` per entry), the schema’s `types` are used when config does not set `types`.
- **Schema**: Export `{name}Meta` for each type (e.g. `termMeta`, `topicMeta`). You can define patterns in the schema so everything lives in one place; see [Configuration – Multi-type collection](../CONFIGURATION.md#multi-type-collection).
- **Generated output**: Same shape as single-type; each entry’s keys come from the schema for that type.

See [Configuration – Multi-type collection](./CONFIGURATION.md#multi-type-collection).
