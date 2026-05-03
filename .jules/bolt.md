## 2024-05-24 - Regex Compilation in Hot Loops
**Learning:** Instantiating `new RegExp()` in a hot loop (like parsing file names for an entire content directory) can become a significant performance bottleneck.
**Action:** Always cache compiled `RegExp` objects (e.g., using a Map keyed by dynamic inputs) when parsing strings in tight loops, especially during file processing and content discovery.
