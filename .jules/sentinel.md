## 2025-01-20 - Arbitrary Code Execution in MDX Adapter
**Vulnerability:** The `@contenz/adapter-mdx` package uses `new Function` to parse JavaScript object literal syntax for MDX metadata (`export const meta = { ... }`), allowing for Arbitrary Code Execution (ACE) if an attacker controls the MDX content.
**Learning:** `new Function` and `eval()` are fundamentally unsafe for parsing object literals in untrusted input because they execute code. This presents a critical risk when processing files from untrusted sources.
**Prevention:** For environment-agnostic packages (like MDX adapters that run in edge/browser), use `json5` or an AST parser instead of `new Function` or `node:vm` to safely parse JS object literal syntax without executing code and without breaking compatibility.
