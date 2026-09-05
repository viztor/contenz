## 2024-05-15 - Dynamic RegExp compilation in hot path

**Learning:** Generating regular expressions dynamically using `new RegExp()` inside a frequently called function (like `parseFileName` which runs per-file during lists, builds, and lints) introduces significant performance overhead, especially in codebases scanning many files.
**Action:** Cache the instantiated RegExp objects using a module-level `Map` with a composite key based on the function parameters to avoid redundant regex compilation.
