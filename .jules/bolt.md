## 2024-05-18 - RegExp Compilation in Hot Loops
**Learning:** Instantiating `new RegExp(...)` repeatedly inside hot loops (like `parseFileName` which processes every file during a build) creates a measurable performance bottleneck due to the cost of parsing and compiling the regular expression repeatedly.
**Action:** Always cache compiled `RegExp` objects outside the function or in a Map keyed by dynamic inputs if they need to be constructed at runtime.
