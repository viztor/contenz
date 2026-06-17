## 2024-05-24 - Cache RegExp creations in hot loops
**Learning:** Frequent instantiations of `new RegExp(...)` within hot loops (like processing thousands of files during a build) introduce unnecessary overhead and Garbage Collection pressure. Furthermore, mapping and joining default arrays repeatedly causes similar issues.
**Action:** Always hoist or cache `RegExp` objects outside of hot path functions using a `Map` keyed by relevant state, and pre-compute any static array operations to a constant.
