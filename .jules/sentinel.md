## 2024-05-24 - [Fix unsafe evaluation in MDX parsing]

**Issue:** Unsafe evaluation via `new Function()` in MDX meta block eval. **Learning:** Using `new Function()` allows arbitrary code execution. **Prevention:** Use `node:vm.runInNewContext` to safely isolate evaluation.
