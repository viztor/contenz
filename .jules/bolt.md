## 2024-05-24 - Avoid dynamic RegExp instantiation in hot loops
**Learning:** Instantiating dynamic `RegExp` objects inside functions called iteratively in bulk (e.g., `parseFileName`) causes severe performance degradation due to compilation overhead.
**Action:** Rely on standard string manipulation (`endsWith`, `lastIndexOf`) or statically compiled regexes when extracting patterns from files in bulk processing paths.
