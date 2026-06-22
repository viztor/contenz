## 2024-06-25 - Cache compiled RegExps in hot loops
**Learning:** In the `@contenz/core` package, filename parsing (`parseFileName`) is executed in a hot loop for every content file during the build process. Constructing and recompiling `RegExp` objects inside this function on every call creates a performance bottleneck due to unnecessary CPU overhead and garbage collection.
**Action:** Always cache compiled `RegExp` objects outside the function or in a `Map` keyed by dynamic inputs if they must be constructed at runtime, as implemented in `packages/core/src/parser.ts` to improve build times.
