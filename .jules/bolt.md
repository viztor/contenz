## 2025-02-18 - Avoid dynamic RegExp in file parsing
**Learning:** Functions that process files in bulk (like `parseFileName` in `@contenz/core`) are critical hot paths. Instantiating dynamic `RegExp` objects inside these functions causes severe performance degradation.
**Action:** Use standard string manipulation (like `endsWith()` and `slice()`) or statically compiled regexes. When extracting extensions, use `endsWith()` against known extensions rather than regex alternation or `lastIndexOf('.')` to prevent breaking support for multi-dot custom extensions.
