## 2024-07-12 - Avoid Dynamic RegExp in High-Frequency Parsers
**Learning:** In `@contenz/core`, functions that process files in bulk (like `parseFileName`) are critical hot paths. Instantiating dynamic `RegExp` objects inside these loops introduces significant parsing and memory allocation overhead.
**Action:** Replace dynamically constructed regular expressions with equivalent string manipulation (e.g., `slice()`, `lastIndexOf()`, `endsWith()`) and statically precompiled regular expressions (without global/sticky flags) for pattern matching to achieve up to a 10x performance improvement.
