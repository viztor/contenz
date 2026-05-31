## 2025-03-02 - Fix arbitrary code execution in MDX parser
**Vulnerability:** Arbitrary Code Execution via `new Function()` in `safeEvalObjectLiteral` of `@contenz/adapter-mdx` used to parse MDX export blocks.
**Learning:** Using `new Function()` to parse strings as object literals is extremely dangerous and allows arbitrary code execution, especially with user-supplied content.
**Prevention:** Use a safer parser like `json5` for parsing complex object literals, especially in edge-compatible environments where `node:vm` is not available.
