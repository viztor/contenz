## 2024-04-29 - Regex Compilation Overhead
**Learning:** Instantiating `new RegExp` for dynamic patterns on every call in hot paths like `parseFileName` (which runs for every file in the directory) introduces significant compilation overhead.
**Action:** Use a `patternCache = new Map<string, RegExp>()` to compile regular expressions once per unique string pattern and reuse them on subsequent calls. This is a crucial architecture-specific performance pattern since parsing filenames is part of the core build pipeline.
