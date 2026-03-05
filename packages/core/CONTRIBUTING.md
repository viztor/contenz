# Contributing

Thanks for your interest in contributing to contenz.

## Setup

```bash
npm install
npm run build
```

Before committing, the pre-commit hook runs `npm run typecheck` and `npm run lint`. Before pushing (or in CI), run the full suite: `npm run build && npm run lint && npm run knip && npm test`.

## Commands

- **`npm run build`** – Build with tsup (ESM + dts)
- **`npm run dev`** – Build in watch mode (tsup)
- **`npm run test`** – Run unit tests (Vitest). From repo root, `npm test` runs both core unit tests and e2e tests (in `packages/e2e`).
- **`npm run test:coverage`** – Run tests with Istanbul coverage
- **`npm run test:watch`** – Run tests in watch mode
- **`npm run typecheck`** – Type-check without emitting
- **`npm run lint`** – Lint and format-check `src` with Biome
- **`npm run lint:fix`** – Lint and format (write) with Biome
- **`npm run format`** – Format code with Biome
- **`npm run check`** – Same as `lint` (Biome check)
- **`npm run knip`** – Find dead code and unused dependencies

## Coverage floor

`packages/core` enforces a minimum test coverage floor in Vitest:

- Statements: `30%`
- Lines: `30%`
- Functions: `30%`
- Branches: `20%`

Raise the floor when hot paths gain durable regression coverage; do not lower it to land unrelated work.

## Adding a fixture

E2E tests and fixtures live in the **`packages/e2e`** package. Each fixture is a minimal project under `packages/e2e/fixtures/`:

1. Add a directory, e.g. `packages/e2e/fixtures/my-fixture/`.
2. Add `content.config.ts` (and optionally `content/…/schema.ts`, `content/…/*.mdx`).
3. Fixtures that have `schema.ts` need `@contenz/core` resolvable: the test runner creates `node_modules/@contenz/core` → core package for fixtures listed in `FIXTURES_WITH_SCHEMA` in `packages/e2e/e2e.test.ts`. Add your fixture name there if it has schemas.
4. Add a describe block in `packages/e2e/e2e.test.ts` that runs the CLI and asserts exit codes and output.

Generated output (`generated/content/`, `content.coverage.md`) in fixtures is gitignored.

## Code style

- TypeScript strict mode; use types from `./types.js` and the main package exports.
- Lint and format with Biome (`npm run lint:fix` or `npm run format`).
