## 2024-11-20 - Set/Map Instantiation in Hot Paths

**Learning:** In hot paths handling small arrays (like locale matching in parseLocaleFromURL), creating new `Set` or `Map` objects purely for case-insensitive lookup introduces unnecessary allocation overhead. Using `Array.prototype.find()` on the small array directly eliminates this overhead without sacrificing functionality. **Action:** Prioritize `Array.prototype.find()` or simple iteration over `Set` / `Map` instantiations for small collections processed in frequently called functions.
