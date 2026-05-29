## 2024-05-19 - [Cache Regular Expressions in Hot Loops]
**Learning:** Instantiating `new RegExp()` with dynamic parts inside a frequently called function (like filename parsing during build/lint processes across many files) can cause significant performance overhead.
**Action:** When regular expressions need to be dynamically constructed based on arguments in a hot loop, use a caching mechanism (e.g., a `Map` keyed by the dynamic input variations) to reuse the compiled `RegExp` objects across invocations.
