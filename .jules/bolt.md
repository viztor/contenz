## 2024-05-24 - Dynamic RegExp in Hot Paths
**Learning:** Instantiating dynamic `RegExp` objects inside hot path functions (like `parseFileName` that processes files in bulk) causes severe performance degradation. Replacing them with standard string manipulation (e.g., `endsWith`, `slice`) yields massive speedups (~11x).
**Action:** Avoid dynamic `RegExp` in bulk processing functions. Use string manipulation or statically compiled regexes instead.
