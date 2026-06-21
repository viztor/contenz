## 2025-02-18 - Caching compiled RegExp in hot loops
**Learning:** Instantiating `new RegExp()` inside a hot loop or frequently called function (like `parseFileName` when reading thousands of files) has a noticeable performance overhead due to the repeated regex compilation.
**Action:** When regular expressions need to be dynamically constructed based on variables (e.g. alternating file extensions), cache the compiled `RegExp` objects in a `Map` keyed by the dynamic input to prevent recompilation, making sure they do not use stateful flags like `g` or `y`.
