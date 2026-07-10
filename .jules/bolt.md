## 2024-05-15 - [Avoid dynamic RegExp in hot paths]
**Learning:** Functions that process files in bulk (like `parseFileName` in `@contenz/core`) are critical hot paths. Instantiating dynamic `RegExp` objects inside these functions (e.g. for matching file extensions and parsing strings) leads to severe performance degradation.
**Action:** Prefer standard string manipulation (e.g., `endsWith` against known extensions, `lastIndexOf`, and slicing) or statically compiled regexes to prevent repetitive and expensive dynamic regex compilation.
