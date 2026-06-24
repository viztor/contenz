## 2024-05-24 - Regular Expression Construction Overhead in Hot Loops
**Learning:** Dynamically constructing `RegExp` objects inside frequently called functions (like `parseFileName` which processes many files during source discovery) introduces significant performance overhead due to the repeated compilation step of the regular expression engine.
**Action:** To prevent performance bottlenecks in hot loops, always cache compiled `RegExp` objects outside the function or in a `Map` keyed by dynamic inputs if they must be constructed at runtime.
