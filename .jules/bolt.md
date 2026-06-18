## 2024-11-20 - RegExp Caching for Hot Loops
**Learning:** In the `parser.ts` file, filename parsing constructs `RegExp` objects based on dynamic properties (e.g., extensions) during hot loops. Recreating `RegExp` objects inside hot loops introduces noticeable overhead when processing a large number of items.
**Action:** Always pre-compute complex string alternations (like default extensions) and use a module-level `Map` cache keyed by dynamic inputs to store and reuse compiled `RegExp` objects, ensuring O(1) retrieval instead of repeated parsing overhead.
