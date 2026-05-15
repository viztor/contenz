
## 2024-05-18 - Caching dynamic RegExp in file parsing
**Learning:** Dynamically constructing RegExp objects in a hot loop (like `parseFileName` during build) is a performance bottleneck.
**Action:** Cache compiled RegExp objects outside the function or in a Map keyed by dynamic inputs.
