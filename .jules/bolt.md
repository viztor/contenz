## 2024-05-18 - RegExp Recompilation in Hot Loops
**Learning:** Instantiating new `RegExp` objects inside functions called frequently (like `parseFileName` parsing every content file during build) is a measurable performance bottleneck in this architecture due to repeated compilation overhead.
**Action:** Always cache compiled `RegExp` objects outside the function or in a `Map` keyed by dynamic inputs if they must be constructed at runtime.
