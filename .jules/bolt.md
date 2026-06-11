## 2024-05-24 - [Cache Compiled RegExps in Hot Loops]
**Learning:** In `@contenz/core`, filename parsing in `parseFileName` constructs complex dynamic `RegExp` objects based on locales and extensions repeatedly during the build process, which acts as a performance bottleneck when iterating through thousands of content files.
**Action:** Always extract `new RegExp` constructions into module-level caching structures (e.g., a `Map` keyed by the dynamic input pattern) whenever the construction happens within a function called repeatedly (like in parsing or build loops).
