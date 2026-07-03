## 2024-07-03 - [CRITICAL] Arbitrary Code Execution in MDX Meta Parser
**Vulnerability:** The `@contenz/adapter-mdx` package used `new Function()` to parse the `export const meta = { ... }` block in MDX files. This allowed arbitrary JavaScript execution if an attacker provided a crafted string.
**Learning:** Parsing JavaScript object literals (like frontmatter) safely requires dedicated parsers rather than dynamic code execution. `new Function` and `eval` should never be used for parsing user-supplied configuration or content strings.
**Prevention:** Use secure parsers like `json5` which safely parse JS object syntax without executing any embedded code.
