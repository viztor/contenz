## 2024-06-24 - O(n²) Array Lookup in Manifest Loops
**Learning:** In `@contenz/core` (`run-build.ts` and `run-status.ts`), looking up collections from the build manifest inside a main iteration loop using `Array.find` causes O(n²) performance degradation.
**Action:** When performing loop-based collection cache validation, precompute a `manifestCollectionsByName` Map and pass it to functions like `getCachedInputHash` to ensure O(1) complexity during lookups.
