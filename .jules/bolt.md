## 2024-05-18 - Optimize manifest lookups inside build loop

**Learning:** Using `Array.prototype.find()` on an array of manifest entries inside a loop that iterates over collection contexts creates an O(N * M) performance bottleneck. Additionally, repeatedly allocating strings for global factors (like `sources.join(",")`) inside the loop creates unnecessary garbage collection overhead.
**Action:** When evaluating global cache factors, perform the evaluations once before iterating. Construct a pre-computed `Map` prior to the loop and use `Map.prototype.get()` to execute cache entry lookups in O(1) time.
