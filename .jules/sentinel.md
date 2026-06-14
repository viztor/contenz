## 2024-06-14 - Arbitrary Code Execution in MDX Adapter
**Vulnerability:** Arbitrary code execution vulnerability via the use of `new Function()` in `safeEvalObjectLiteral` parsing `export const meta = { ... }` blocks.
**Learning:** Parsing MDX content which may contain malicious code with `new Function()` executes arbitrary JavaScript within the Node.js environment during parsing.
**Prevention:** Always use safe parser libraries (like `json5` or an AST parser) rather than raw dynamic evaluation (`eval` or `new Function()`) for evaluating untrusted source text.
