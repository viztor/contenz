## 2024-05-14 - Pre-compute and Cache RegExp in hot parsing loops
**Learning:** Instantiating `new RegExp` and executing `Array.prototype.map().join()` within a frequently called utility like `parseFileName` causes measurable overhead during build time due to dynamic regex compilation in hot loops.
**Action:** When parsing thousands of files, always pre-compile regex or use a `patternCache` (`Map`) keyed by the dynamic input patterns. Also pre-compute common string alternations (like default extensions) statically at the module level.
