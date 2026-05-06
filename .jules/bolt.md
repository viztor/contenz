
## 2024-05-18 - [Cache Compiled RegEx in parser.ts]
**Learning:** `new RegExp()` inside a hot loop (like filename parsing for content files) creates noticeable overhead when traversing large document collections. Compiling Regex patterns in every call of `parseFileName` negatively impacts performance.
**Action:** Always cache compiled `RegExp` objects either outside the function for static patterns or in a Map for dynamically generated patterns keyed by dynamic inputs.
