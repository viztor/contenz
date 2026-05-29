## 2024-05-29 - Semantic CLI Formatting

**Learning:** When developing CLI tools, printing complex nested objects directly as strings produces flat, dense outputs that are hard to scan. Many third-party libraries (like `picocolors` or `chalk`) can colorize text, but managing object traversal and serialization requires heavy lifting.
**Action:** Use Node's built-in `node:util` `inspect` utility with `{ colors: true }` combined with bold ANSI formatting (`\x1b[1m`) for object keys. This provides rich, semantic highlighting for primitives (strings, booleans, numbers) and objects without adding any new external dependencies.
