## 2023-10-24 - [Avoid Map/Set allocations on hot paths]

**Learning:** Instantiating new `Map` or `Set` objects for small collections (like locales arrays) on every function call in hot paths creates unnecessary memory allocation overhead. **Action:** Use `Array.prototype.find()` or similar built-in methods instead of creating Maps/Sets when searching small collections.
