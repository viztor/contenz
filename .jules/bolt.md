## 2024-06-25 - RegExp Reconstruction in Hot Loops
**Learning:** Dynamically reconstructing strings and reinstantiating `RegExp` objects inside heavily-used utility functions (like `parseFileName` which processes every content file) causes significant overhead and slows down build times.
**Action:** Always cache compiled `RegExp` objects (using a `Map` keyed by deterministic arguments or outside the function body) for operations inside hot loops to ensure fast execution.
