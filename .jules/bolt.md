## 2024-06-12 - Optimize Manifest Collection Lookups
**Learning:** O(n) lookups using `Array.prototype.find()` inside a loop over collections in `packages/core/src/run-build.ts` and `packages/core/src/run-status.ts` resulted in O(n²) complexity during the main build loop when checking the cache manifest. This architecture specific bottleneck degraded performance for projects with large numbers of collections.
**Action:** Always precompute a `Map` (e.g., `manifestCollectionsByName`) to ensure O(1) lookups during hot paths or large iteration loops, avoiding nested O(n) searches on collections.
