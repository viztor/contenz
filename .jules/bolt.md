## 2024-05-24 - Cache RegExp compilation in parser hot loop
**Learning:** During the build process, `parseFileName` is called for every file to extract slugs and locales. Dynamically constructing and compiling new `RegExp` objects on every call creates significant GC pressure and slows down parsing for large collections.
**Action:** Always use a module-level cache (e.g., `Map<string, RegExp>`) for dynamically constructed regular expressions that are evaluated inside hot loops (like file parsing loops).
