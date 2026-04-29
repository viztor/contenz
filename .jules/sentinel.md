## 2024-04-29 - Arbitrary Code Execution in MDX Evaluation
**Vulnerability:** Found `new Function` being used to evaluate user-provided string (`export const meta = ...`) from MDX files.
**Learning:** This could allow an attacker to achieve Arbitrary Code Execution (ACE) if an unprivileged user writes or updates an MDX file that is parsed by the `@contenz/adapter-mdx` package. Since `new Function` runs code in the global scope, it is dangerous.
**Prevention:** Replaced `new Function` with `node:vm` `runInContext` using an empty context (`Object.create(null)`) and a strict 50ms timeout. This restricts what the evaluated code can access and limits the execution time.
