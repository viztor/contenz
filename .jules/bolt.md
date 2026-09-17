## 2025-02-12 - Regex Compilation Overhead in File Scanning

**Learning:** Repeatedly calling `new RegExp` in hot paths (like parsing file names across the entire workspace) creates significant overhead. In the core content parser, recompiling the same RegExp for every file took ~240ms for 100k iterations.
**Action:** Use a `WeakMap` keyed by the stable extensions array (or other stable config references) to cache the compiled RegExps. This avoids string concatenation and regex parsing on every call, yielding a ~3-4x speedup.
