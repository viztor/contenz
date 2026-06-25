## 2024-06-25 - Optimize manifest collection lookups to O(1)
**Learning:** Found an O(N²) bottleneck in `packages/core/src/run-build.ts` and `run-status.ts`. Collection lookups during incremental build used a `.find()` iteration over the array of collections from `manifest`.
**Action:** Replaced `.find()` over array with precomputed `Map` for lookup to allow O(1) performance in `getCachedInputHash`.
