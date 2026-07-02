
## 2024-05-18 - Arbitrary Code Execution via `new Function` in Adapter
**Vulnerability:** Found `new Function` being used to parse `export const meta = ...` string contents in `@contenz/adapter-mdx/src/index.ts`.
**Learning:** This usage enables Arbitrary Code Execution (ACE) since the string contents being evaluated come directly from files that users or outside contributors could potentially control. Relying on `node:vm` in this context isn't an option because it would break edge compatibility (e.g. Next.js App Router edge functions).
**Prevention:** Avoid `new Function` or `eval` for parsing object literal text. Always use an AST parser or safe evaluators like `json5`, which handles JS object literal syntax safely while maintaining edge compatibility.
