## 2024-05-18 - Avoid redundant Map/Set allocations in i18n URL/header parsing

**Learning:** Instantiating new `Set` and `Map` objects on every single function call in hot paths like URL parsing (`parseLocaleFromURL`) and header negotiation (`negotiateLocale`) causes unnecessary memory allocation overhead. Since the input arrays are typically small and static references, caching the derived objects based on array reference avoids this.
**Action:** Use a `WeakMap` keyed by the input array reference to cache the derived `Set` and `Map` in hot path utility functions.

## 2024-05-19 - Replace Set with Array for cycle detection in shallow depths

**Learning:** Using `Set` for detecting visited nodes or cycles in recursive un-wrapping paths (like Zod schemas or localization fallback chains) is sub-optimal when the depth is consistently small (usually < 5 items). The cost to allocate the `Set` and add items outweighs the $O(1)$ lookup advantage.
**Action:** When tracking visited items for cycle detection or fallback chains in hot paths with a small, known maximum depth, use an Array with `.includes()` instead of instantiating a new `Set` to avoid repeated memory allocation and garbage collection overhead.

## 2024-05-20 - Avoid chained array allocations in string parsing loops

**Learning:** Chaining array methods like `.split(",")`, `.map()`, and `.filter()` to process strings (like HTTP headers) in hot paths creates multiple short-lived intermediate array allocations, increasing garbage collection overhead.
**Action:** Replace array chains with imperative `while` loops using direct string manipulation methods like `.indexOf()` and `.slice()` for performance-critical parsing functions.
