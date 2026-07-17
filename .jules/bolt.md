## 2026-07-17 - Avoid Dynamic RegExp in Hot Paths
**Learning:** In `@contenz/core`, functions that process files in bulk (like `parseFileName`) are critical hot paths. Instantiating dynamic `RegExp` objects inside these functions causes severe performance degradation.
**Action:** Avoid dynamic `RegExp` creation in hot paths. Prefer standard string manipulation or statically compiled regexes. When extracting extensions, use `endsWith()` against known extensions rather than `lastIndexOf('.')` to prevent breaking support for multi-dot custom extensions (e.g., `.page.md`).
