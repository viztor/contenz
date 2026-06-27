## 2025-06-27 - Cache Regex Parsing for file names
**Learning:** In `@contenz/core`, filename parsing occurs heavily during build processes. Using `new RegExp` for each parse operation introduces noticeable performance overhead. Caching compiled `RegExp` objects based on `i18nEnabled` and expected extensions bypasses this overhead without sacrificing any correctness.
**Action:** When evaluating functions run in hot loops or heavily in map operations, replace repeated `new RegExp` with a module-level cached version. Do not use global (`g`) or sticky (`y`) flags in these shared cache instances.
