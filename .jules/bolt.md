## 2024-05-24 - Map/Set Allocations in Hot Paths

**Learning:** Instantiating new `Set` and `Map` objects on hot paths like `parseLocaleFromURL` for small collections introduces unnecessary memory allocation overhead and GC pressure.
**Action:** Use built-in array methods like `Array.prototype.find()` for lookups in small collections to avoid memory allocations, ensuring invariant computations (e.g., target string lowercasing) are hoisted outside the callback.
