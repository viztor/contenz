## 2024-04-22 - Arbitrary Code Execution in MDX Parser
**Vulnerability:** The MDX parser used `new Function()` to evaluate the `export const meta = ...` blocks in `.mdx` files. This allowed for arbitrary Remote Code Execution (RCE) without sandboxing, affecting all environments that parse these files.
**Learning:** Evaluating untrusted object literals using `new Function` inside parsers is extremely dangerous, as it executes with the full privileges of the Node.js process and can trivially bypass standard security controls.
**Prevention:** Instead of using `new Function` or `eval()`, use `node:vm`'s `runInNewContext` with timeouts to safely execute isolated strings as JavaScript code without giving them access to the global context or built-in modules.
