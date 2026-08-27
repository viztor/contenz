## 2025-02-14 - RegExp Compilation Bottleneck

**Learning:** Instantiating `new RegExp(...)` dynamically inside a hot loop (like iterating and parsing thousands of file names) causes unnecessary overhead. **Action:** Use a memoization strategy (`Map`) to cache and reuse RegExp objects for dynamically constructed patterns.
