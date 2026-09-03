## 2025-05-23 - Avoid Map/Set allocation for small arrays in hot paths

**Learning:** Instantiating `Map` and `Set` objects dynamically inside frequently called functions (like URL parsing or locale negotiation) creates unnecessary memory allocation and garbage collection overhead, especially when the source arrays are small (e.g. 2-5 elements). The overhead of initialization outweighs the O(1) lookup benefit.
**Action:** For small collections in hot paths, prefer built-in array methods like `Array.prototype.find()` to eliminate memory allocation overhead while maintaining functional equivalence. Ensure invariant string manipulation (like converting a target to lowercase) is hoisted outside the iteration callback.
