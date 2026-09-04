## 2024-09-04 - Fix unvalidated code evaluation

**Issue:** The MDX adapter evaluated frontmatter objects using `new Function()`, which can run unintended logic.
**Learning:** Even internal toolings or adapters can act as an attack vector when they evaluate file contents dynamically.
**Prevention:** Always use `vm.runInNewContext(code, Object.create(null))` to isolate dynamically evaluated code.
