## 2024-05-20 - [Cache RegExp in hot loops]
**Learning:** In `parseFileName` (which is called frequently during the build phase to identify collection directories and parse file names), compiling regular expressions via `new RegExp(...)` on every call creates a performance bottleneck.
**Action:** Always cache compiled `RegExp` objects outside the function or in a `Map` keyed by dynamic inputs if they must be constructed at runtime. Pre-compute constant string parts (like `DEFAULT_EXT_ALT`) to further reduce string manipulation overhead.
