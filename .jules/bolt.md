## 2025-02-28 - [Cache Compiled Regex for Tight Loops]
**Learning:** `new RegExp` initialization inside frequently called functions (like `parseFileName` which processes every content file) adds measureable overhead and increases garbage collection pressure.
**Action:** Use a `Map` cache (e.g., `patternCache`) to store and reuse compiled `RegExp` objects by building deterministic cache keys for string-based regex patterns when processing large batches of items.
