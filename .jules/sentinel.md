## 2024-05-15 - [Critical] ACE in MDX Metadata Evaluation
**Vulnerability:** Arbitrary Code Execution (ACE) via `new Function` in `packages/adapter-mdx/src/index.ts` during metadata parsing (`export const meta = ...`).
**Learning:** Evaluating untrusted object literals using `new Function` allows code execution within the global scope, especially risky in tools compiling or processing user-provided MDX files.
**Prevention:** Use `node:vm`'s `runInNewContext` with an empty context (`Object.create(null)`) and an execution timeout to safely evaluate JS objects, preventing prototype pollution, scope leaks, and infinite loops.
