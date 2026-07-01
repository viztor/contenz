## 2024-07-01 - Optimizing RegExp execution time
**Learning:** When creating `RegExp` objects in a frequently called loop (e.g. `parseFileName` inside `run-build`), you can cache and reuse these objects significantly speeding up string matching.
**Action:** Extract invariant components and cache the RegExp based on these pieces.
