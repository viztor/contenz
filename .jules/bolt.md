## YYYY-MM-DD - Cache mapped values to prevent redundant computation
**Learning:** `splitCollections.map((c) => c.meta)` is computed 4 times in `packages/core/src/run-build.ts`. This mapping is called repeatedly over the same immutable array.
**Action:** Extract this out into a local variable (`const splitMeta = splitCollections.map((c) => c.meta)`) to prevent multiple O(n) array loops and memory allocations.
