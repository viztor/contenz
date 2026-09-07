## 2024-09-07 - Avoid Set/Map instantiation overhead in hot paths

**Learning:** Parsing URLs or Accept-Language headers often happens on hot request paths. Instantiating new `Set` or `Map` objects on every call, especially for small collections like available locales, introduces unnecessary memory allocation overhead. Built-in array methods like `find` are often faster for small arrays.
**Action:** When working with small arrays in hot paths, avoid creating throwaway Sets or Maps for lookups. Use `Array.prototype.find()` instead, and remember to hoist invariant operations (like target string lowercasing) outside the iteration callback.
