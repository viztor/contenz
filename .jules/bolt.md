## 2024-08-16 - Cache compiled RegExp

**Learning:** Instantiating `new RegExp(...)` within a function called repeatedly (like in a loop processing files) can be a significant performance bottleneck. **Action:** When working with dynamically built regular expressions that do not change during an operation, cache the compiled RegExp instance rather than recreating it on every function call.

## 2024-08-16 - Ensure Pre-Commit Scripts (like knip) Run Successfully

**Learning:** When making code changes, tests and linters might pass, but secondary validation scripts (like `knip` for detecting unused exports/dependencies) may fail if the project configuration isn't perfectly tuned for the tools used. **Action:** Always ensure you review the exact failing CI job logs to pinpoint the issue. In this case, `oxlint` and `oxfmt` were flagged by `knip` as unused dependencies because they were invoked via `pnpm run` rather than being explicitly declared as ignored binaries in the configuration. Ignoring those binaries within `knip.json` solved the issue.

## 2024-08-16 - Prettier format compliance with nested ternaries
**Learning:** Oxc fmt (or Prettier) enforces strict formatting on nested ternary operators, often requiring parentheses for readability or altering line breaks.
**Action:** When manually fixing nested ternary expressions, ensure parentheses are wrapped around the inner ternary block. E.g., `a ? b : (c ? d : e)` rather than `a ? b : c ? d : e`.
