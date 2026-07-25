
## 2024-10-24 - Dynamic RegExp in parseFileName
**Learning:** In `@contenz/core`, `parseFileName` is a hot path called frequently for bulk file processing. Instantiating a dynamic `RegExp` inside this function causes performance degradation. Also, using `endsWith` instead of `lastIndexOf('.')` is necessary for multi-dot custom extensions.
**Action:** When extracting extensions, use standard string manipulation or statically compiled regexes. Avoid instantiating dynamic RegExp inside hot loops. Use `endsWith` for known extensions.
