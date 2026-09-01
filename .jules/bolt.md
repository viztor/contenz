## 2025-02-12 - i18n Hot Path Performance Fix

**Learning:** Instantiating `Set` and `Map` on every function call for small collections (like locales) creates significant garbage collection overhead and reduces execution speed in hot paths compared to simple array iteration (`Array.prototype.find()`). **Action:** When iterating through small array configurations (under ~20 items) inside frequently called functions (like routing or parsers), prioritize simple array methods over casting to sets or maps for lookups.
