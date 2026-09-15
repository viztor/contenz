## 2025-02-23 - WeakMap RegExp caching in hot paths

**Learning:** Generating regular expressions dynamically in a hot path like `parseFileName` adds significant allocation and compilation overhead. Caching compiled `RegExp` instances in a `WeakMap` keyed by the stable `extensions` array reference avoids this overhead while preventing memory leaks.
**Action:** When dynamically generating complex patterns based on configuration arrays in hot paths, utilize a `WeakMap` to cache the compiled results rather than concatenating strings and allocating new `RegExp` instances on every invocation.
