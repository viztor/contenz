## 2024-08-28 - Unsafe execution in MDX adapter

**Issue:** The MDX adapter evaluated untrusted metadata using `new Function`, allowing for unintended code execution. **Learning:** Using `new Function` with untrusted input can lead to execution in the main context. **Prevention:** Use `node:vm` to create a sandboxed context without access to globals and stringify the results.
