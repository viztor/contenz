## 2024-05-12 - Prevent RegExp recreation in hot loops
**Learning:** Instantiating new `RegExp` objects inside hot loops (like file parsing during build/lint) introduces a significant performance bottleneck.
**Action:** Always pre-compile `RegExp` objects outside functions or cache them in a Map keyed by dynamic inputs if they must be constructed at runtime to prevent repeated parsing and compilation overhead.
