## 2024-06-25 - Avoid Array.find() inside O(n) loops over collections
**Learning:** Calling `Array.find()` to look up an item in a list from within a loop that also iterates over a proportional number of items results in an O(n²) performance degradation. This was observed in `run-build.ts` and `run-status.ts` where we were searching the build manifest for cached input hashes.
**Action:** When performing item lookups inside a hot loop, precompute a `Map` structured as O(1) keyed lookups outside the loop.
