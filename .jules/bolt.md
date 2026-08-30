## 2024-03-20 - [Optimize URL Locale Parsing]

**Learning:** Instantiating `URL` and creating `Set`/`Map` objects inside hot path utilities like `parseLocaleFromURL` creates significant overhead. In tight loops, simple string operations and `Array.find` are measurably faster. **Action:** Avoid heavy object allocations in frequently called utility functions; prefer lighter primitives and built-in array methods for small collections.
