## 2024-05-18 - Avoid redundant Map/Set allocations in i18n URL/header parsing

**Learning:** Instantiating new `Set` and `Map` objects on every single function call in hot paths like URL parsing (`parseLocaleFromURL`) and header negotiation (`negotiateLocale`) causes unnecessary memory allocation overhead. Since the input arrays are typically small and static references, caching the derived objects based on array reference avoids this.
**Action:** Use a `WeakMap` keyed by the input array reference to cache the derived `Set` and `Map` in hot path utility functions.

## 2024-05-18 - Array includes vs Set has for bounded small lookups

**Learning:** Using `new Set()` in hot paths (like fallback resolution walking over thousands of items) creates significant memory allocation overhead. When the lookup size is strictly bounded and very small (e.g. `MAX_FALLBACK_DEPTH = 5`), using a simple Array and `Array.prototype.includes` is faster and reduces garbage collection pressure compared to instantiating a Set on every call.
**Action:** Use an Array for cycle detection or visited tracking in hot paths when the maximum size is known to be very small, rather than defaulting to `Set`.
