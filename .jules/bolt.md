## 2025-02-18 - Caching regex compilation in parsing

**Learning:** Re-compiling regular expressions on every single file parse operation can become a significant bottleneck when reading large content collections. **Action:** Extract and cache `RegExp` objects in hot paths like `parseFileName` using a module-level `Map` cache based on the configuration arguments.
