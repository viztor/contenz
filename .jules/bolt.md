## 2024-05-18 - Avoid Dynamic RegExp in Hot Paths
**Learning:** Instantiating dynamic `RegExp` objects inside functions that process files in bulk (like `parseFileName` in `@contenz/core`) causes severe performance degradation.
**Action:** Prefer standard string manipulation (like `.endsWith`, `.slice`) or statically compiled regexes for these hot paths to improve parsing speed by >10x. When extracting extensions, use `endsWith()` against known extensions rather than `lastIndexOf('.')` to prevent breaking support for multi-dot custom extensions.
