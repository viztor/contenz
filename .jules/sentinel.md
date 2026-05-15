## 2025-02-28 - Arbitrary Code Execution in MDX Adapter
**Vulnerability:** The `@contenz/adapter-mdx` package used `new Function()` to evaluate MDX `export const meta = { ... }` blocks at runtime, leading to Arbitrary Code Execution if a malicious file was parsed.
**Learning:** This existed because `new Function()` was an easy way to evaluate stringified Javascript objects. In an environment-agnostic edge/browser context, the standard `node:vm` cannot be used without breaking compatibility.
**Prevention:** Use a safer AST or JSON parser. For edge-compatible object literal evaluation, replace `new Function()` with `JSON5.parse()` to safely parse the object string without executing arbitrary code.
