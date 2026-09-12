## 2024-03-24 - Cache File Name RegExp Patterns

**Learning:** `parseFileName` dynamically creates RegExp instances inside loops that iterate over thousands of files. Re-compiling the same RegExp for every iteration creates unnecessary allocations and CPU overhead in hot paths during build. Cache the RegExp based on the `extensions` list. `WeakMap` is preferred for memoization if we're basing it on array reference (since it prevents unbounded growth), but since we map an array to an alternation string, we can memoize the compiled RegExp by the `extAlternation` output string in a simple `Map`.
**Action:** Extract RegExp compilation to use a memoized cache keyed by the extension alternation string to reduce parsing time in `parseFileName`.
