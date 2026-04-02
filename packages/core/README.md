# @contenz/core

Core library for contenz. This package owns schema helpers, shared types, and the programmatic build/lint API.

It does not ship the `contenz` binary. CLI usage lives in `@contenz/cli`.

## What belongs here

- `defineCollection` and `defineMultiTypeCollection`
- config and schema types such as `ContenzConfig` and `CollectionConfig`
- programmatic APIs from `@contenz/core/api`

## Installation

```bash
npm install @contenz/core
```

## Schema helpers

```ts
import { defineCollection } from "@contenz/core";
import { z } from "zod";

const schema = z.object({
  question: z.string(),
  category: z.enum(["products", "ordering"]),
});

export const { meta, relations } = defineCollection({
  schema,
  relations: {
    glossaryLinks: "glossary",   // any field name → target collection
  },
});
```

For multi-type collections you can put schemas and (optionally) patterns in one place:

```ts
import { defineMultiTypeCollection } from "@contenz/core";
import { z } from "zod";

const termSchema = z.object({ term: z.string() });
const topicSchema = z.object({ title: z.string() });

export const { termMeta, topicMeta, meta, relations, types } = defineMultiTypeCollection({
  schemas: {
    topic: { schema: topicSchema, pattern: /^topic-/ },
    term: { schema: termSchema, pattern: /.*/ },
  },
});
```

Then you can omit `config.types` in `config.ts`. Or use plain `schemas: { term: termSchema, topic: topicSchema }` and set `config.types` in `config.ts`. See [Configuration – Multi-type](../../docs/CONFIGURATION.md#multi-type-collection).

## Programmatic API

Import runtime entry points from `@contenz/core/api`:

```ts
import { loadProjectConfig, runBuild, runLint } from "@contenz/core/api";

const cwd = process.cwd();
const config = await loadProjectConfig(cwd);

const lintResult = await runLint({ cwd, coverage: true });
const buildResult = await runBuild({ cwd });
```

## Related docs

- [Repository README](../../README.md) – overview and CLI
- [Documentation index](../../docs/README.md) – full docs (config, CLI, content model, API)
- [CONTRIBUTING](../../CONTRIBUTING.md) – workspace setup and code style
- [packages/core/CONTRIBUTING.md](./CONTRIBUTING.md) – core package notes (if present)
