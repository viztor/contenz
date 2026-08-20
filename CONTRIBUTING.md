# Contributing

Thanks for your interest in contributing to contenz.

This is the main contribution guide for the workspace. Package READMEs should describe package APIs; contributor workflow lives here.

## Setup

```bash
pnpm install
pnpm run build
```

Requires **Node.js LTS** (currently ≥ 24) and **pnpm 11** (see root `packageManager` / `engines`).

Before committing, the pre-commit hook runs **lint-staged** (oxfmt + oxlint on staged files).

Before pushing, run the workspace checks:

```bash
pnpm run build
pnpm test
pnpm run typecheck
pnpm run lint
pnpm run format:check
```

Or the combined gate:

```bash
pnpm run ci
```

## Workspace commands

| Command | Purpose |
| --- | --- |
| `pnpm run build` | Build all packages with Turbo |
| `pnpm test` | Run package tests (core, cli, adapter-mdx, e2e) |
| `pnpm run typecheck` | Typecheck packages that declare `typecheck` |
| `pnpm run lint` | Root oxlint (type-aware) |
| `pnpm run format` / `format:check` | oxfmt write / check |
| `pnpm run knip` | Dead code / unused deps |
| `pnpm run test:coverage` | Coverage (core floor enforced) |
| `pnpm run publish:all` / `publish:dry` | Release helpers (`catalog:` ranges are rewritten on publish) |

Package-scoped:

```bash
pnpm --filter @contenz/core test
pnpm --filter @contenz/cli build
```

## E2E fixtures

E2E tests and fixtures live in `packages/e2e`.

When adding a fixture:

1. Add a directory under `packages/e2e/fixtures/`.
2. Add `contenz.config.ts` and any needed `content/.../schema.ts` and content files.
3. Register it in `packages/e2e/setup.ts` (`FIXTURES_WITH_SCHEMA` / `linkAllFixtures` callers).
4. Add or extend coverage in `e2e.test.ts` / advanced / stress suites.

Shared helpers: `packages/e2e/setup.ts` (`runCli`, `linkFixturePackages`, `cleanGenerated`, …).

Generated fixture output (`generated/`, `.contenz/`, coverage markdown) is gitignored.

## Packages

| Package | Role |
| --- | --- |
| `@contenz/core` | Schema helpers, pipeline, programmatic API; coverage floor in Vitest |
| `@contenz/cli` | `contenz` binary and command wiring |
| `@contenz/adapter-mdx` | MD/MDX format adapter |
| `@contenz/e2e` | Fixture-based CLI verification (private) |

Internal monorepo deps use `workspace:*`. Shared third-party versions live in the `catalog:` map in `pnpm-workspace.yaml` and are referenced as `"catalog:"` from each package.json. `pnpm publish` replaces those with the catalog ranges in the tarball.

## Planning docs

- `PROJECT_SCOPE.md` — long-lived product direction
- `ROADMAP.md` — milestone sequencing

For user-facing and API documentation, see [docs/](./docs/README.md).

## Core quality gate

`packages/core` enforces this minimum coverage floor:

- Statements / lines / functions: `30%`
- Branches: `20%`

Raise the floor when hot paths gain durable coverage; do not lower it to land unrelated work.

## Code style

- TypeScript ESM with local `./foo.js` import paths
- **oxlint** (type-aware) + **oxfmt** via Ultracite presets at the repo root
- Keep package docs package-specific; workspace process docs live here
