## 2024-05-18 - Caching derived RegExp objects in hot paths using WeakMap

**Learning:** Re-instantiating identical regular expressions inside frequently called loops (like `parseFileName` traversing thousands of files) generates significant memory allocation overhead. Caching them using string keys causes further string allocations. However, since the extensions list relies on stable array references, a `WeakMap` allows caching the compiled `RegExp` against the array reference directly without any additional serialization overhead.
**Action:** When building cached lookup tables or derived logic based on objects or arrays in a hot path, prefer `WeakMap` with the object/array reference as the key instead of attempting to serialize arguments into cache string keys.
