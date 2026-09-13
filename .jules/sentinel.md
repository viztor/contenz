## 2024-10-24 - Arbitrary code evaluation via new Function (False Positive)

**Vulnerability:** Evaluated untrusted markdown object literals using `new Function()`, theoretically risking arbitrary code execution.
**Learning:** Sandboxed evaluation in `new Function()` is sometimes a deliberate design choice for isomorphic packages (like MDX adapters) that must run in edge environments without `node:vm`. Using `node:vm` introduces a Node-only dependency and breaks existing capabilities (like Date/Math objects). The `vm` module is also not a real security sandbox.
**Prevention:** Do not replace `new Function()` with `node:vm` in isomorphic edge-compatible code without understanding the environment constraints.
