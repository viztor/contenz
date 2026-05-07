## 2026-05-07 - Avoid constructing RegExp objects in hot loops

**Learning:** Reconstructing the same `RegExp` objects inside tight loops can lead to severe performance degradation. This is especially true when dynamic regexes are built from extension lists in highly called functions like `parseFileName`.
**Action:** Always pre-compile `RegExp` instances and store them in a cache (such as a `Map` keyed by the dynamic string combinations) outside of the loop so they can be reused across invocations.
