## 2024-06-25 - Caching RegExp in hot loops
**Learning:** In heavily used string parsing functions (like `parseFileName` traversing large file trees), repeatedly evaluating `new RegExp` with dynamic strings (even if the resulting pattern is the same) introduces a significant CPU bottleneck. V8 has to compile the regex pattern each time.
**Action:** Always cache compiled `RegExp` objects outside the function or in a `Map` keyed by the dynamic input pattern if they must be constructed at runtime and are expected to be reused frequently.
