## 2025-02-14 - Cache regex compilation in hot paths

**Learning:** Frequent, dynamic regex compilation using `new RegExp()` in a hot path like `parseFileName` causes significant performance overhead and object allocations (nearly a 40-50% speed increase when cached). **Action:** When working in hot paths like parsers, search indexers, or heavily repeated file scanning utilities, lift `new RegExp` initialization out of the function body or use a module-level `Map` to memoize the compiled regex pattern using deterministic cache keys.
