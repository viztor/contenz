# Contributing

Thanks for your interest in contributing to content-tools.

## Setup

```bash
npm install
npm run build
```

Before committing, the pre-commit hook runs `npm run typecheck` and `npm run lint`. Before pushing (or in CI), run the full suite: `npm run build && npm run lint && npm run knip && npm test`.

## Commands

- **`npm run build`** – Build with tsup (ESM + dts)
- **`npm run dev`** – Build in watch mode (tsup)
- **`npm run test`** – Run unit and e2e tests (Vitest)
- **`npm run test:coverage`** – Run tests with Istanbul coverage
- **`npm run test:watch`** – Run tests in watch mode
- **`npm run typecheck`** – Type-check without emitting
- **`npm run lint`** – Lint and format-check `src` and `tests` with Biome
- **`npm run lint:fix`** – Lint and format (write) with Biome
- **`npm run format`** – Format code with Biome
- **`npm run check`** – Same as `lint` (Biome check)
- **`npm run knip`** – Find dead code and unused dependencies

## Adding a fixture

E2E tests use fixtures under `tests/fixtures/`. Each fixture is a minimal project:

1. Add a directory, e.g. `tests/fixtures/my-fixture/`.
2. Add `content.config.ts` (and optionally `content/…/schema.ts`, `content/…/*.mdx`).
3. Fixtures that have `schema.ts` need `content-tools` resolvable: the test runner creates `node_modules/content-tools` → project root for fixtures listed in `FIXTURES_WITH_SCHEMA` in `tests/e2e.test.ts`. Add your fixture name there if it has schemas.
4. Add a describe block in `tests/e2e.test.ts` that runs the CLI and asserts exit codes and output.

Generated output (`generated/content/`, `content.coverage.md`) in fixtures is gitignored.

## Code style

- TypeScript strict mode; use types from `./types.js` and the main package exports.
- Lint and format with Biome (`npm run lint:fix` or `npm run format`).
