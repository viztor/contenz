## 2024-03-01 - Arbitrary Code Execution in MDX Metadata Parsing
**Vulnerability:** Found `new Function` being used to evaluate user-provided string literals representing MDX metadata objects in `@contenz/adapter-mdx` (`safeEvalObjectLiteral`).
**Learning:** `new Function` allows arbitrary code execution in the current context. Even though it's wrapped in a "strict" function returning an object literal, malicious code embedded inside the object structure or an IIFE can still execute before returning the value.
**Prevention:** Always use `node:vm`'s `runInNewContext` with an empty context (`Object.create(null)`) and an execution timeout to sandbox evaluation of dynamic Javascript structures or objects, instead of `new Function` or `eval`.
