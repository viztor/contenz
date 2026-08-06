## 2026-06-14 - Optimize manifest lookups to O(1)
**Learning:** During the `run-build` and `run-status` loops over collections, looking up a collection by name in the manifest using `Array.prototype.find()` causes O(n²) time complexity.
**Action:** Always precompute an O(1) Map (`manifestCollectionsByName`) before entering main compilation loops and pass it to utility functions (`getCachedInputHash`) to prevent performance degradation at scale.
