## 2024-06-13 - [RegExp compilation in hot loops]
**Learning:** Instantiating `new RegExp()` inside a hot loop (like parsing thousands of filenames during a static site build) can cause significant overhead.
**Action:** Always cache compiled `RegExp` objects outside the function or in a `Map` keyed by dynamic inputs if they must be constructed at runtime.
