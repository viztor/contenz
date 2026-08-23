## 2024-08-23 - RegExp Compilation in Hot Paths

**Learning:** Dynamic RegExp creation inside hot loops (like filename parsing during bulk search operations) can introduce measurable CPU overhead. In our parser, recompiling complex i18n locale and extension-matching regexes for every file added roughly 30% overhead during parsing. **Action:** Always memoize RegExp instances when the pattern is constructed dynamically from a limited set of inputs (like enabled extensions or i18n settings), particularly if the function is called per-file or in tight loops.
