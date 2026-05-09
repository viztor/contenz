## 2024-05-09 - RegExp Recompilation in Hot Loops
**Learning:** Instantiating `RegExp` objects inside hot loops (like filename parsing for thousands of files in `parser.ts`) creates a significant performance bottleneck specific to this codebase's architecture where many files are processed rapidly.
**Action:** Always use a cache (like a `Map` keyed by the dynamic input properties) for compiled `RegExp` patterns that are constructed dynamically to avoid unnecessary recompilation.
