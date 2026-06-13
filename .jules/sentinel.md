## 2026-05-01 - [CRITICAL] Arbitrary Code Execution in MDX Evaluation
**Vulnerability:** Evaluating user-provided MDX `export const meta` object literals using `new Function`.
**Learning:** This codebase previously evaluated dynamic object literals using `new Function` in the MDX adapter (`safeEvalObjectLiteral`), creating an Arbitrary Code Execution risk if parsing untrusted content.
**Prevention:** Replaced `new Function` with `node:vm`'s `runInNewContext` utilizing an empty context (`Object.create(null)`) and a strict execution timeout (`{ timeout: 50 }`). To support this, ensure `"types": ["node"]` is added to `tsconfig.json`.
