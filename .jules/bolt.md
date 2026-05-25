## 2024-05-25 - Avoid new RegExp inside hot loops

**Learning:** Recompiling Regular Expressions on every filename parsed causes unnecessary CPU overhead, especially when parsing large collections of files. Pre-computing regex strings or extracting fixed calculations into global constants is also necessary.
**Action:** Extract compiled `RegExp` objects out of functions or cache them using a `Map` keyed by deterministic arguments. Pre-compute constant string alternations (like `DEFAULT_ALT` for extensions).
