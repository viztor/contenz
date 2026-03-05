# contenz workspace

This repository uses a Turborepo workspace layout. All packages are published under the **@contenz** scope on npm and live under the same group on Git (e.g. GitHub org `contenz`).

## Packages

- `packages/core` – core library (published as `@contenz/core`); programmatic API only, no CLI binary
- `packages/cli` – CLI (published as `@contenz/cli`); provides the `contenz` binary
- `packages/e2e` – e2e tests and fixtures (private; not published)

## Common commands

- `npm run build` - build all packages
- `npm run test` - run tests for all packages
- `npm run lint` - lint all packages
- `npm run typecheck` - typecheck all packages

To run package-level commands directly:

```bash
npm run build --workspace @contenz/core
```
