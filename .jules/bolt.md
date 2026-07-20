## 2024-05-24 - Dynamic RegExp in Hot Paths
**Learning:** Functions that process files in bulk (like `parseFileName` in `@contenz/core`) are critical hot paths. Dynamically instantiating `RegExp` objects inside these loops causes severe performance degradation (e.g. ~750ms for 100k calls).
**Action:** When extracting components like extensions, prefer standard string manipulation (e.g. `endsWith()`, `slice()`) or statically compiled regexes. Avoid using `lastIndexOf('.')` for extensions to maintain support for multi-dot extensions (e.g., `.page.md`).
