## 2024-07-11 - Dynamic Regex in Hot Paths
**Learning:** Instantiating `RegExp` objects dynamically inside functions that are called frequently in a loop (like `parseFileName` for bulk file operations) causes severe performance degradation due to regex compilation overhead.
**Action:** Replace dynamic regex with statically compiled regexes or standard string manipulation (`endsWith`, `slice`, `lastIndexOf`) for parsing operations in hot paths to drastically improve speed (~10x faster).
