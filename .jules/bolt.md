## 2024-06-21 - Avoiding new Set/Map creation in hot i18n paths

**Learning:** The URL parsing and header negotiation logic for locales previously instantiated new Set and Map objects on every single invocation. In highly concurrent scenarios where URLs and headers are checked frequently, this causes unnecessary garbage collection and memory overhead.
**Action:** When handling small static arrays of known variants (like locales), use `Array.prototype.find()` over `new Set()` creation, and hoist invariant operations (like lowercase conversions) outside the iteration callback for the best performance.
