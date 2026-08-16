## 2024-08-16 - Cache compiled RegExp

**Learning:** Instantiating `new RegExp(...)` within a function called repeatedly (like in a loop processing files) can be a significant performance bottleneck. **Action:** When working with dynamically built regular expressions that do not change during an operation, cache the compiled RegExp instance rather than recreating it on every function call.

## 2024-08-16 - Ensure Pre-Commit Scripts (like knip) Run Successfully
**Learning:** When making code changes, tests and linters might pass, but secondary validation scripts (like `knip` for detecting unused exports/dependencies) may fail if the project configuration isn't perfectly tuned for the tools used.
**Action:** Always ensure you review the exact failing CI job logs to pinpoint the issue. In this case, `oxlint` and `oxfmt` were flagged by `knip` as unused dependencies because they were invoked via `pnpm run` rather than being explicitly declared as ignored binaries in the configuration. Ignoring those binaries within `knip.json` solved the issue.
