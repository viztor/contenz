## 2024-05-19 - Regex Compilation in Hot Loops
**Learning:** Compiling RegExp objects inline within functions called in hot loops (like filename parsing for every file in the build process) introduces unnecessary overhead and object churn. Repeatedly computing default arrays (like extension strings) exacerbates this.
**Action:** Use a `Map` caching mechanism (`patternCache`) keyed by dynamic inputs to store and reuse compiled RegExp objects. Pre-compute constant array operations (like default extension formatting) outside the function scope.
