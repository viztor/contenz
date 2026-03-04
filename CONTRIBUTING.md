# Contributing

Thanks for your interest in contributing to content-tools.

## Setup

```bash
npm install
npm run build
```

## Commands

- **`npm run build`** – Compile TypeScript to `dist/`
- **`npm run test`** – Run unit and e2e tests (Vitest)
- **`npm run test:coverage`** – Run tests with Istanbul coverage
- **`npm run test:watch`** – Run tests in watch mode
- **`npm run typecheck`** – Type-check without emitting
- **`npm run lint`** – Lint `src` and `tests` with ESLint
- **`npm run format`** – Format code with Prettier
- **`npm run format:check`** – Check formatting without writing

## Adding a fixture

E2E tests use fixtures under `tests/fixtures/`. Each fixture is a minimal project:

1. Add a directory, e.g. `tests/fixtures/my-fixture/`.
2. Add `content.config.ts` (and optionally `content/…/schema.ts`, `content/…/*.mdx`).
3. Fixtures that have `schema.ts` need `content-tools` resolvable: the test runner creates `node_modules/content-tools` → project root for fixtures listed in `FIXTURES_WITH_SCHEMA` in `tests/e2e.test.ts`. Add your fixture name there if it has schemas.
4. Add a describe block in `tests/e2e.test.ts` that runs the CLI and asserts exit codes and output.

Generated output (`generated/content/`, `content.coverage.md`) in fixtures is gitignored.

## Code style

- TypeScript strict mode; use types from `./types.js` and the main package exports.
- Format with Prettier (`npm run format`). ESLint runs with `eslint-config-prettier` so it does not conflict with Prettier.
