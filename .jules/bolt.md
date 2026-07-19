## 2024-10-27 - Avoid dynamic RegExp in parseFileName hot path
**Learning:** Creating dynamic `RegExp` objects inside `parseFileName` (which is a hot path for processing files) causes severe performance degradation compared to string manipulation and static regexes.
**Action:** Use standard string manipulation (`endsWith`, `slice`) and statically compiled regexes when parsing filenames in bulk operations.
