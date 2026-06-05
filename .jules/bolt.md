## 2024-06-05 - Cache dynamic RegExp constructions in hot loops
**Learning:** In `@contenz/core`'s file parsing loop (`parseFileName`), compiling new `RegExp` objects based on dynamic inputs (like file extensions and i18n flags) for every single file causes O(N) regex compilations, creating a significant performance bottleneck during build times for large content collections.
**Action:** Always cache compiled `RegExp` objects outside the function or in a `Map` keyed by dynamic inputs (e.g., `extensions` array joined + boolean flags) if they must be constructed at runtime.
