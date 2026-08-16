## 2024-08-16 - Cache compiled RegExp

**Learning:** Instantiating `new RegExp(...)` within a function called repeatedly (like in a loop processing files) can be a significant performance bottleneck. **Action:** When working with dynamically built regular expressions that do not change during an operation, cache the compiled RegExp instance rather than recreating it on every function call.
