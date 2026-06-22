## 2024-05-24 - [Fix Arbitrary Code Execution in MDX Metadata]
**Vulnerability:** The `@contenz/adapter-mdx` package used `new Function` to parse the `export const meta` block in MDX files, which allowed arbitrary code execution if evaluating untrusted content.
**Learning:** Dynamic object literal evaluation should not rely on `new Function` or `eval` because it gives full execution context to untrusted inputs. Using `json5` provides identical functionality for relaxed JSON object literals without the risk.
**Prevention:** Avoid `new Function` and `eval` entirely. Always use robust parsing tools like `json5` or an AST parser to safely handle dynamic JS syntax.
