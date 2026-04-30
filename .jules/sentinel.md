# Sentinel's Journal

## 2025-02-14 - [Arbitrary Code Execution in MDX Adapter]
**Vulnerability:** Found `new Function` being used to evaluate dynamic object literals for frontmatter/meta parsing in `@contenz/adapter-mdx`.
**Learning:** Evaluating untrusted or dynamic strings as code via `new Function` or `eval` opens the door for Arbitrary Code Execution (ACE) / Remote Code Execution (RCE), particularly if the Markdown input is ever partially controlled or influenced by external users, or even just as a principle of defense-in-depth against poisoned inputs.
**Prevention:** Use `runInNewContext` from `node:vm` with an execution timeout and an explicitly empty context (`Object.create(null)`) to sandbox the execution of object literals, ensuring no access to the Node.js environment or globals.
