## 2024-05-23 - Regex Compilation Overhead
**Learning:** Re-compiling regular expressions inside a hot path like `parseFileName` causes a significant performance hit when processing many files.
**Action:** Module-level caching for regex patterns derived from config options drastically improves performance.
