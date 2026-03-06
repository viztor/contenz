# Contributing

Thanks for your interest in contributing to contenz.

This is the main contribution guide for the workspace. Package READMEs should describe package APIs; contributor workflow lives here.

## Setup

```bash
npm install
npm run build
```

Before committing, the pre-commit hook runs `npm run typecheck` and `npm run lint`.

Before pushing, run the workspace checks:

```bash
npm run build
npm run test
npm run typecheck
npm run lint
```

## Workspace commands

- `npm run build` - build all packages with Turbo
- `npm run test` - run core and e2e tests
- `npm run typecheck` - typecheck all packages
- `npm run lint` - run configured lint tasks across the workspace
- `npm run knip` - find dead code and unused dependencies

To run commands for one package:

```bash
npm run test --workspace @contenz/core
npm run build --workspace @contenz/cli
```

## E2E fixtures

E2E tests and fixtures live in `packages/e2e`.

When adding a fixture:

1. Add a directory under `packages/e2e/fixtures/`.
2. Add `contenz.config.ts` and any needed `content/.../schema.ts` and content files.
3. If the fixture has schemas, add it to `FIXTURES_WITH_SCHEMA` in `packages/e2e/e2e.test.ts`.
4. Add or extend the e2e test coverage in `packages/e2e/e2e.test.ts`.

Generated fixture output such as `generated/content/` and `contenz.coverage.md` is gitignored.

## Package notes

- `@contenz/core`
  - schema helpers and programmatic APIs
  - enforces a minimum coverage floor in Vitest
- `@contenz/cli`
  - owns the `contenz` binary and command wiring
- `@contenz/e2e`
  - fixture-based CLI verification

## Planning docs

Tracked root planning docs have distinct roles:

- `PROJECT_SCOPE.md` for long-lived product direction
- `ROADMAP.md` for milestone sequencing
- `BACKLOG.md` for near-term executable work

Temporary planning drafts should stay local-only and out of the canonical repo docs.

For user-facing and API documentation (config, CLI, content model, Studio, core API), see the [docs/](./docs/README.md) folder.

## Core quality gate

`packages/core` currently enforces this minimum test coverage floor:

- Statements: `30%`
- Lines: `30%`
- Functions: `30%`
- Branches: `20%`

Raise the floor when hot paths gain durable regression coverage; do not lower it to land unrelated work.

## Code style

- Use TypeScript package exports and local `./types.js` imports consistently.
- Keep package docs package-specific; put workspace process docs at the repo root.
- Use Biome for formatting and lint fixes where configured.
