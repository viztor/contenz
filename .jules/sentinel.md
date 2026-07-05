
## 2024-05-24 - Arbitrary Code Execution in MDX Adapter Metadata Parser
**Vulnerability:** The `@contenz/adapter-mdx` package used `new Function()` to parse JavaScript object literals representing MDX metadata (`export const meta = { ... }`). This enabled arbitrary code execution if malicious code (e.g. an Immediately Invoked Function Expression) was placed inside the object values.
**Learning:** Evaluated object literals (`safeEvalObjectLiteral`) using `new Function` are incredibly dangerous because they execute within the Node.js context and can require system modules like `fs` or `child_process`.
**Prevention:** Avoid dynamic code evaluation functions like `eval()` and `new Function()`. Instead, use safe parsers like `JSON.parse()` or, for more relaxed syntaxes, `json5`, which safely parse data structures without code execution capabilities.
