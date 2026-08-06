## 2024-06-16 - Prevent O(n²) Array Lookups in Loops
**Learning:** Calling `Array.prototype.find` inside a loop (`run-build.ts`, `run-status.ts`) causes `O(n²)` performance degradation when the array (like the `manifest.collections`) is large.
**Action:** Precompute a `Map` before the loop and pass it down so lookups (like in `getCachedInputHash`) are done in `O(1)` time.
