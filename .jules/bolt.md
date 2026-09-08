## 2024-05-18 - Optimize locale parsing in hot paths

**Learning:** Instantiating new `Set` or `Map` objects inside frequently called locale utility functions (`parseLocaleFromURL`, `negotiateLocale`) creates unnecessary memory allocation overhead. For small arrays of known locales, `Array.prototype.find()` is significantly faster and uses less memory.
**Action:** When working with hot paths processing small collections, avoid instantiating new `Set` or `Map` objects. Use built-in array methods like `find()` and hoist invariant computations to eliminate redundant processing.
