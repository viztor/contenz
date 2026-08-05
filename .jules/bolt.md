## 2025-02-12 - Avoid Dynamic RegExp in Hot Paths
**Learning:** Recompiling dynamic `RegExp` objects inside tight loops (like `parseFileName` which processes thousands of files) has severe performance penalties in V8.
**Action:** Use native string methods (`lastIndexOf`, `substring`) for parsing highly structured data like filenames.
