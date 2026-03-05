# contenz workspace

This repository uses a Turborepo workspace layout. All packages are published under the **@contenz** scope on npm and live under the same group on Git (e.g. GitHub org `contenz`).

## Packages

- `packages/core` – core library (published as `@contenz/core`); programmatic API only, no CLI binary
- `packages/cli` – CLI (published as `@contenz/cli`); provides the `contenz` binary
- `packages/e2e` – e2e tests and fixtures (private; not published)

## Documentation

- Project scope: [/Users/viz/dev/contenz/PROJECT_SCOPE.md](/Users/viz/dev/contenz/PROJECT_SCOPE.md)
- Delivery roadmap: [/Users/viz/dev/contenz/ROADMAP.md](/Users/viz/dev/contenz/ROADMAP.md)
- Active backlog: [/Users/viz/dev/contenz/BACKLOG.md](/Users/viz/dev/contenz/BACKLOG.md)
- Core library API: [/Users/viz/dev/contenz/packages/core/README.md](/Users/viz/dev/contenz/packages/core/README.md)
- Workspace contribution guide: [/Users/viz/dev/contenz/CONTRIBUTING.md](/Users/viz/dev/contenz/CONTRIBUTING.md)

## Common commands

- `npm run build` - build all packages
- `npm run test` - run tests for all packages
- `npm run lint` - lint all packages
- `npm run typecheck` - typecheck all packages

To run package-level commands directly:

```bash
npm run build --workspace @contenz/core
```

## Project setup

For CLI usage:

```bash
npm install -D @contenz/cli
```

For library usage in schema/config files:

```bash
npm install @contenz/core
```

## CLI usage

```bash
# Validate all content
contenz lint

# Validate one collection
contenz lint --collection faq

# Write coverage report
contenz lint --coverage

# Generate content data
contenz build
```

Use `--cwd` when the content project root is not the current directory:

```bash
contenz lint --cwd ../other-package
contenz build --cwd .
```

## Configuration

Create `contenz.config.ts` in the project root:

```ts
import type { ContenzConfig } from "@contenz/core";

export const config: ContenzConfig = {
  i18n: true,
  strict: false,
  ignore: ["README.md", "_*"],
  // contentDir: "content",
  // outputDir: "generated/content",
  // coveragePath: "contenz.coverage.md",
  // extensions: ["md", "mdx"],
};
```

The loader checks `contenz.config.ts`, then `contenz.config.mjs`, then `contenz.config.js`. Legacy `content.config.*` files are still supported as a fallback.

Use `content/<collection>/config.ts` only when a collection needs overrides:

```ts
import type { CollectionConfig } from "@contenz/core";

export const config: CollectionConfig = {
  types: [
    { name: "topic", pattern: /^topic-/ },
    { name: "term", pattern: /.*/ },
  ],
};
```

## Project shape

```text
project-root/
├── contenz.config.ts
├── contenz.coverage.md
├── content/
│   ├── faq/
│   │   ├── schema.ts
│   │   └── *.{locale}.mdx
│   └── terms/
│       ├── schema.ts
│       ├── config.ts
│       └── *.{locale}.mdx
└── generated/
    └── content/
        ├── index.ts
        ├── faq.ts
        └── terms.ts
```

## Filename patterns

| i18n | Pattern | Example |
|------|---------|---------|
| `true` | `{slug}.{locale}.{ext}` | `moq.en.mdx` |
| `false` | `{slug}.{ext}` | `hello-world.mdx` |

## Generated output shape

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

Without i18n:

```ts
export const posts = {
  "hello-world": {
    slug: "hello-world",
    file: "hello-world.mdx",
    title: "Hello World",
  },
};
```

## Relation validation

Relation validation rules:

- missing target slug: error
- self-reference: warning
- circular reference: informational

Fields matching `related{Collection}` are auto-detected:

- `relatedTerms` -> `terms`
- `relatedFaqs` -> `faq`

For non-standard names, export explicit relations from the schema module:

```ts
export const relations = {
  featuredTerms: "terms",
};
```

## Import patterns

```ts
import { faq } from "@/generated/content/faq";
import { faq, terms } from "@/generated/content";
```
