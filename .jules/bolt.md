## 2024-05-15 - [Avoid dynamic RegExp creation in hot paths]
**Learning:** Instantiating `RegExp` objects inside functions that process files in bulk (like `parseFileName`) acts as a critical hot path. Generating standard string manipulation alternatives can dramatically enhance execution speed.
**Action:** When extracting extensions or parsing predefined string formats repeatedly, prefer standard string manipulation (e.g. `endsWith()`, `lastIndexOf()`) or statically compiled regexes to prevent severe performance degradation.
