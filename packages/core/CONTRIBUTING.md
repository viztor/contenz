# @contenz/core Contributing Notes

The main contribution guide lives at [/Users/viz/dev/contenz/CONTRIBUTING.md](/Users/viz/dev/contenz/CONTRIBUTING.md).

This file only keeps notes that are specific to `@contenz/core`.

## Package commands

```bash
npm run build --workspace @contenz/core
npm run test --workspace @contenz/core
npm run test:coverage --workspace @contenz/core
npm run typecheck --workspace @contenz/core
npm run lint --workspace @contenz/core
```

## Package-specific expectations

- Keep `packages/core/README.md` focused on the library API, not general workspace setup.
- Add direct regression tests for programmatic APIs when changing `runBuild`, `runLint`, config loading, parsing, generation, or validation.
- Maintain the core coverage floor enforced in `packages/core/vitest.config.ts`.
