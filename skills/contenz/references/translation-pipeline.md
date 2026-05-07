# Translation Pipeline Reference

This document covers advanced translation workflows for Contenz projects with i18n enabled. Read this when automating bulk translation, managing locale coverage, or building CI-integrated translation pipelines.

## Table of contents

1. [Understanding i18n in Contenz](#understanding-i18n-in-contenz)
2. [Audit: coverage and staleness](#audit-coverage-and-staleness)
3. [Single-item translation](#single-item-translation)
4. [Batch translation script](#batch-translation-script)
5. [Updating stale translations](#updating-stale-translations)
6. [CI integration](#ci-integration)
7. [Programmatic API for translation](#programmatic-api-for-translation)

---

## Understanding i18n in Contenz

Contenz embeds the locale in the filename: `{slug}.{locale}.{ext}`. Each locale variant is a separate file with its own metadata validated against the same schema.

Key config fields (in `contenz.config.ts` under `i18n`):

| Field | Purpose |
|-------|---------|
| `defaultLocale` | Source language for translation and staleness detection |
| `locales` | Explicit locale list; omit to infer from filenames |
| `fallback` | `Record<locale, fallbackLocale>` for missing translations |
| `coverageThreshold` | 0–1 ratio; warns when coverage is below this |
| `detectStale` | Emit diagnostics when translation is older than the source |

## Audit: coverage and staleness

Before translating, always audit what's missing:

```bash
# Full coverage report (writes contenz.coverage.md)
contenz lint --coverage

# Machine-readable for scripting
contenz lint --coverage --format json
```

The coverage report shows:
- Per-collection locale coverage percentages
- Per-slug missing locale list
- Stale translations (when `detectStale: true`)

Parse the JSON output to build a list of `{ collection, slug, missingLocales }` work items.

## Single-item translation

### Metadata-only content (JSON files)

```bash
# 1. Read source
contenz view faq moq --locale en --format json
# → { "meta": { "question": "What is MOQ?", "category": "products" }, "body": "" }

# 2. Create translated version
contenz create faq moq --locale zh \
  --set question="最低起订量是多少？" \
  --set category=products \
  --format json

# 3. Validate
contenz lint --collection faq --format json
```

### Content with body (MDX/MD files)

The `contenz create` command writes metadata but produces an empty body. For body-bearing content, write the file directly:

```bash
# 1. Read the source to get both meta and body
SOURCE=$(contenz view blog welcome --locale en --format json)
# Parse the meta fields and body from the JSON

# 2. Write the translated file
cat > content/blog/welcome.zh.mdx << 'EOF'
---
title: 欢迎
category: general
---

欢迎来到我们的博客。这是第一篇文章。
EOF

# 3. Validate
contenz lint --collection blog --format json
```

## Batch translation script

Here is the general algorithm for translating all missing locales in a collection:

```
INPUT:  collection name, target locale
OUTPUT: translated content files

1. schema = contenz schema <collection> --format json
   → Extract field names, types, required fields

2. items = contenz list <collection> --format json
   → Get all slugs and their existing locales

3. For each slug missing the target locale:
   a. source = contenz view <collection> <slug> --locale <defaultLocale> --format json
      → Get the source meta and body

   b. Translate each meta field value to the target locale
      - Preserve enum values as-is (they are code identifiers)
      - Translate string fields
      - Preserve number/boolean fields as-is
      - For arrays of strings, translate each element

   c. contenz create <collection> <slug> --locale <targetLocale> \
        --set field1="translated" --set field2="translated" \
        --format json

   d. If the content has a body (body is non-empty in the source):
      Write the full file with translated frontmatter + body to:
      content/<collection>/<slug>.<targetLocale>.<ext>

4. contenz lint --coverage --format json
   → Verify all new files pass validation and coverage improved

5. contenz build --force
   → Regenerate typed outputs with new translations
```

### Handling enum fields

When translating, check the schema introspection output. Fields with `"type": "enum"` have an `"options"` array — these values must be used exactly as-is (they're code identifiers, not user-facing text):

```json
{
  "category": { "type": "enum", "required": true, "options": ["products", "ordering"] }
}
```

Always pass enum values unchanged: `--set category=products`

### Handling optional fields

Optional fields (`"required": false`) can be omitted in the target locale. Schema defaults will apply automatically.

## Updating stale translations

When `detectStale: true` is configured, `contenz lint` flags translations that are older than the source locale file. To update them:

```bash
# 1. Find stale items via lint
contenz lint --coverage --format json
# Look for stale diagnostics in the output

# 2. View the current source
contenz view <collection> <slug> --locale en --format json

# 3. View the stale translation
contenz view <collection> <slug> --locale zh --format json

# 4. Update the changed fields
contenz update <collection> <slug> --locale zh \
  --set question="新翻译" \
  --format json
```

## CI integration

### GitHub Actions: validate translations on PR

```yaml
name: Content Validation
on: [pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx contenz lint --format github
      - run: npx contenz lint --coverage --dry-run
      - run: npx contenz build --dry-run --format github
```

### Enforce coverage threshold

Set `coverageThreshold` in the i18n config. When coverage drops below, `contenz lint` emits warnings. With `strict: true`, warnings become errors and the lint exits non-zero.

```ts
i18n: {
  enabled: true,
  defaultLocale: "en",
  locales: ["en", "zh"],
  coverageThreshold: 0.9,  // 90% coverage required
  detectStale: true,
}
```

## Programmatic API for translation

For maximum control, use the `@contenz/core/api` directly in a script:

```ts
import {
  runList, runView, runCreate, runUpdate,
  runSchema, runLint, runBuild,
} from "@contenz/core/api";

const cwd = process.cwd();
const targetLocale = "zh";
const sourceLocale = "en";

// 1. Get all collections
const { data: listData } = await runList({ cwd });

for (const col of listData.collections) {
  // 2. Get the schema
  const { data: schemaData } = await runSchema({ cwd, collection: col.name });

  // 3. List items in this collection
  const { data: itemsData } = await runList({ cwd, collection: col.name });

  for (const item of itemsData.items) {
    // 4. Check if target locale exists
    if (item.locale === targetLocale) continue;

    // 5. Read source content
    const { data: source } = await runView({
      cwd, collection: col.name, slug: item.slug, locale: sourceLocale,
    });
    if (!source) continue;

    // 6. Translate meta (implement your translation logic here)
    const translatedMeta = await translateMeta(source.meta, schemaData.schema);

    // 7. Create the translated item
    await runCreate({
      cwd, collection: col.name, slug: item.slug,
      locale: targetLocale, meta: translatedMeta,
    });
  }
}

// 8. Validate and build
await runLint({ cwd, coverage: true });
await runBuild({ cwd, force: true });
```

See `docs/API.md` for the complete type signatures of each function.
