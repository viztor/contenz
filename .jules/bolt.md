## 2024-10-24 - Expensive regex instantiation in tight loops

**Learning:** In the `parseFileName` hot path (called heavily in nested loops when searching content files), dynamically building and compiling RegExp objects on every call creates significant CPU overhead and memory allocations.
**Action:** Cache compiled RegExps based on stable references (like the `extensions` array via WeakMap) to minimize redundant string manipulations and regex compilations.
