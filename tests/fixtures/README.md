# E2E fixtures

These projects are used by `tests/e2e.test.ts` to run the CLI end-to-end.

| Fixture          | Purpose |
|------------------|--------|
| **minimal**      | Flat single collection, no i18n. Valid schema and content. |
| **i18n**         | Single collection with `i18n: true`, multiple locales (en, zh). |
| **multi-type**   | Collection with multiple content types (term + topic) and type patterns. |
| **invalid-schema**| Content that fails Zod validation (question too short). Lint must exit 1. |
| **invalid-relation** | `relatedFaqs` references a slug that does not exist. Lint must exit 1. |
| **empty**        | No `*/schema.ts`; tests "No schema files found" path. |

Before running the CLI in a fixture that has schema files, the test runner creates `node_modules/content-tools` as a symlink to the repo root so that `import "content-tools"` in schema files resolves.

Generated output (`generated/content/`, `content.coverage.md`) is gitignored.
