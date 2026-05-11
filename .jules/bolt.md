## 2024-05-11 - Dynamic RegExp Compilation in Hot Loops
**Learning:** Instantiating `new RegExp(...)` and recalculating string alternations on every invocation inside hot loops (like `parseFileName` when processing thousands of files) introduces a massive overhead.
**Action:** Use a `Map` caching mechanism mapping dynamic inputs to compiled `RegExp` objects, and precompute static strings. This yields a significant performance boost (~10x faster when parsing file names repeatedly).
