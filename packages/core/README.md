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

export const { meta, metaSchema, relations } = defineCollection({
  schema,
});
```

For multi-type collections:

```ts
import { defineMultiTypeCollection } from "@contenz/core";
import { z } from "zod";

const termSchema = z.object({
  term: z.string(),
});

const topicSchema = z.object({
  title: z.string(),
});

export const { termMeta, topicMeta, meta, relations } = defineMultiTypeCollection({
  schemas: { term: termSchema, topic: topicSchema },
});
```

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

- Workspace overview: [/Users/viz/dev/contenz/README.md](/Users/viz/dev/contenz/README.md)
- Workspace contribution guide: [/Users/viz/dev/contenz/CONTRIBUTING.md](/Users/viz/dev/contenz/CONTRIBUTING.md)
- Core package notes: [/Users/viz/dev/contenz/packages/core/CONTRIBUTING.md](/Users/viz/dev/contenz/packages/core/CONTRIBUTING.md)
