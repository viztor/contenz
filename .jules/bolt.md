## 2026-08-04 - RegExp Instantiation in parseFileName
**Learning:** Instantiating `RegExp` repeatedly inside frequently called loops/functions (e.g., `parseFileName`) can cause noticeable performance degradation due to compilation overhead.
**Action:** Cache the instantiated `RegExp` instances using a `Map` outside the function scope, keying them by their dynamic parameter values.
