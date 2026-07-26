## 2024-05-24 - Avoiding dynamic RegExp in hot paths
**Learning:** Instantiating new `RegExp` objects inside hot path functions that process files in bulk (like `parseFileName` in `@contenz/core`) causes severe performance degradation compared to standard string manipulation.
**Action:** When extracting extensions or parsing strings in hot paths, prefer statically compiled regexes or string operations like `endsWith()` or `lastIndexOf()`. Always iterate over known extensions to prevent breaking support for multi-dot custom extensions (e.g., `.page.md`).
