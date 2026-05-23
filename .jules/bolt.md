## 2026-05-23 - RegExp Caching in Hot Loops
**Learning:** Recompiling Regular Expressions inside hot loops like filename parsing `parseFileName` can cause significant performance bottlenecks since `new RegExp` is expensive. This is especially true during full workspace builds where thousands of files are processed.
**Action:** Always cache compiled `RegExp` objects outside the function or in a `Map` keyed by dynamic inputs when dealing with hot loops.
