## 2024-05-27 - Caching regular expressions for dynamic inputs
**Learning:** `RegExp` construction inside hot paths like parsing many file names causes a performance bottleneck.
**Action:** Use a `patternCache` (`Map`) to cache constructed `RegExp` based on dynamic inputs (like `i18nEnabled` flag and `extensions` list) to avoid unnecessary regex compilation overheads. This pattern provided a ~5x speedup for `parseFileName`.
