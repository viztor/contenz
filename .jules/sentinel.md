## 2025-07-06 - Arbitrary Code Execution in Object Literal Parsing
**Vulnerability:** The `@contenz/adapter-mdx` package used `new Function` to parse JavaScript object literal syntax for MDX metadata (`export const meta = { ... }`). This could be exploited to run arbitrary code using expressions like `(function(){...})()`.
**Learning:** Evaluated or dynamic parsing of code strings, such as `new Function` or `eval`, provides a vector for code execution and should be strictly avoided when parsing serialized object formats.
**Prevention:** Always use safe parsing libraries designed for the intended format (e.g., `json5` to safely parse JavaScript object literal syntax) rather than dynamically evaluating the string as code.
