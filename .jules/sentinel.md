
## 2024-05-24 - [CRITICAL] Prevent Arbitrary Code Execution in MDX Parser
**Vulnerability:** Found `new Function` being used to parse `export const meta = { ... }` in MDX files (`packages/adapter-mdx/src/index.ts`). This could allow attackers to execute arbitrary code if they control the content repository, as `new Function` evaluates code in the global scope.
**Learning:** Parsing object literals via native Javascript evaluation is risky in content processing adapters, as malicious repositories could inject payloads causing ACE.
**Prevention:** Always use `node:vm` with `runInNewContext` passing an empty context (`Object.create(null)`) and an explicit execution `timeout` instead of `new Function` or `eval`. Ensure that any package executing user code has `"types": ["node"]` configured.
