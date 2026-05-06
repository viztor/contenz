## 2024-05-06 - Arbitrary Code Execution in MDX metadata parser
**Vulnerability:** The `safeEvalObjectLiteral` function in `@contenz/adapter-mdx` used `new Function` to parse JavaScript object literals. This allowed arbitrary code execution if an attacker could control the metadata string (e.g., via a malicious `.mdx` file), as `new Function` executes code within the global scope.
**Learning:** `new Function` and `eval()` are fundamentally unsafe for parsing untrusted input, even if the input is expected to be just an object literal.
**Prevention:** Always use `node:vm`'s `runInNewContext` with an empty context (`Object.create(null)`) and a strict execution timeout to safely evaluate dynamic JavaScript or object literals, isolating the evaluation from the host environment.
