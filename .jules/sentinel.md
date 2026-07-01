## 2024-07-01 - Prevent Arbitrary Code Execution in MDX Adapter
**Vulnerability:** Arbitrary Code Execution via `new Function` in `safeEvalObjectLiteral` parsing `export const meta = { ... }` in MDX files.
**Learning:** Evaluating MDX frontmatter export expressions with `new Function` (or `eval()`) opened the application to Arbitrary Code Execution vulnerabilities if malicious content is processed. MDX typically supports JS object literal syntax which is difficult to parse without execution or complex parsing.
**Prevention:** Use `json5` to safely parse JS object literal syntax without code execution, maintaining format support while keeping the application secure.
