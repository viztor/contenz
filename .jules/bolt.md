## 2024-05-18 - Avoid redundant Map/Set allocations in i18n URL/header parsing

**Learning:** Instantiating new `Set` and `Map` objects on every single function call in hot paths like URL parsing (`parseLocaleFromURL`) and header negotiation (`negotiateLocale`) causes unnecessary memory allocation overhead. Since the input arrays are typically small and static references, caching the derived objects based on array reference avoids this.
**Action:** Use a `WeakMap` keyed by the input array reference to cache the derived `Set` and `Map` in hot path utility functions.
