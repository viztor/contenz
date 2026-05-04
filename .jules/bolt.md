## 2024-05-04 - RegExp Optimization in Parser Hot Loop
**Learning:** Instantiating `new RegExp` instances dynamically within file parsing loops causes significant overhead. The array map/replace operations for default extensions also add unnecessary computation inside the hot path.
**Action:** Always pre-compute static defaults outside the function and cache dynamic `RegExp` instances in a `Map` (keyed by input permutations) when they must be constructed at runtime.
