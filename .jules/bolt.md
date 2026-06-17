
## 2023-10-25 - [Caching regular expressions in filename parsing]
**Learning:** In a codebase that parses a massive number of files like `@contenz/core`, dynamic RegExp generation in the critical path (such as inside `parseFileName` when matching locales and extensions) can lead to significant garbage collection and parsing overhead.
**Action:** Use a `Map` cache (e.g., `patternCache`) combined with a clear cache key (like `i18nEnabled` + `extensions` string) to compile regular expressions once and reuse them. Also pre-compute common string alternations.
