## 2024-03-24 - Arbitrary Code Execution in MDX Adapter

**Vulnerability:** The `@contenz/adapter-mdx` package used `new Function()` in `safeEvalObjectLiteral` to parse `export const meta = { ... }` blocks from MDX files. This allowed arbitrary JavaScript execution if malicious MDX content was parsed.
**Learning:** Using `new Function()` to parse stringified JavaScript objects is a major security risk (Arbitrary Code Execution / Remote Code Execution), even if the input appears constrained to a specific syntax like object literals.
**Prevention:** Avoid dynamic evaluation like `eval()` or `new Function()`. For environment-agnostic packages (like MDX adapters that run in edge/browser), use `json5` or an AST parser instead of `node:vm` to safely parse JS object literal syntax without breaking compatibility.
