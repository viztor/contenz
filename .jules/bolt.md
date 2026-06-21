## 2026-06-08 - Regex Compilation Overhead in Hot Loops
**Learning:** Compiling dynamic regular expressions (e.g. `new RegExp(...)`) on the fly inside frequently called functions (such as parsing filenames during a build or loop) incurs a significant performance cost.
**Action:** When constructing dynamic regexes based on variables (like file extensions or patterns), always cache the compiled `RegExp` object outside the function or in a `Map` keyed by the dynamic input to reuse across multiple executions.
