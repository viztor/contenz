## 2025-02-23 - Optimize hot paths by removing dynamic RegExp
**Learning:** Using `new RegExp` inside functions that process files in bulk (like `parseFileName`) causes significant performance degradation.
**Action:** Avoid instantiating dynamic `RegExp` objects inside these functions. Prefer standard string manipulation (e.g. `endsWith`, `slice`, `lastIndexOf`) or statically compiled regexes.
