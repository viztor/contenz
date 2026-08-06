## 2024-06-15 - [O(1) Collection Lookup Optimization]
**Learning:** In `@contenz/core` (`run-build.ts` and `run-status.ts`), looking up collections from the build manifest using `.find` inside a loop degrades performance to O(n²).
**Action:** Use a precomputed `Map` for collection lookups (`manifestCollectionsByName`) and pass it to functions like `getCachedInputHash` to ensure O(1) complexity during main loops.
