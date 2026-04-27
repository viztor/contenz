## 2024-04-27 - Regex Compilation in Filename Parser
**Learning:** `new RegExp` initialization inside loops or heavily reused parser functions like `parseFileName` causes significant performance overhead. Although V8 caches regular expressions internally, instantiating the `new RegExp` and processing strings repeatedly adds measurable GC pressure and execution time.
**Action:** Always extract Regex compilation into outer scopes or use an LRU/Map cache for dynamic regular expressions constructed inside tight loops or hot paths (e.g., `packages/core/src/parser.ts`).

## 2024-04-27 - Array Operations in Fast Paths
**Learning:** Operations like `.map().join("|")` inside functions that process thousands of filenames are very slow because they allocate arrays repeatedly on every function invocation.
**Action:** When working with default array parameters (like `DEFAULT_EXTENSIONS`), precalculate their derivatives if possible, and reuse the values instead of calculating them dynamically.
