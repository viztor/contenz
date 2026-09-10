## 2024-05-18 - Fix unsafe code evaluation in mdx adapter

**Issue:** Evaluation of stringified objects using unsafe methods (`new Function`) which can lead to arbitrary code execution if the input is untrusted.
**Learning:** `new Function()` evaluate strings as JavaScript and when they contain untrusted data they can execute malicious code.
**Prevention:** Always use safe sandboxing mechanisms like `node:vm.runInNewContext(code, Object.create(null))` to evaluate stringified objects when avoiding `JSON.parse` is necessary.
