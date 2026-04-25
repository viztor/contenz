## 2024-05-24 - [Compiled RegExp Caching]
**Learning:** Performance can be severely impacted by runtime `RegExp` compilation on hot paths, such as filename parsing or iterative matching. In our codebase, creating new `RegExp` objects inside frequently called loops/functions (e.g., `parseFileName`) caused unnecessary overhead.
**Action:** When a regular expression is constructed dynamically but reused with the same patterns, memoize it using a `Map` cache (e.g., `patternCache`). This avoids repeated compilation and significantly speeds up operations like content file parsing during builds.
