## 2024-03-25 - Fix Arbitrary Code Execution (ACE) in MDX Adapter

**Vulnerability:** Found `new Function` being used in `@contenz/adapter-mdx` to parse MDX frontmatter `export const meta = {...}` blocks. This is a critical security vulnerability that allows Arbitrary Code Execution (ACE) if an attacker can control or influence the MDX files being processed.

**Learning:** `new Function` executes strings as code in the global scope without any sandboxing. Although MDX files are typically authored by developers, in CMS or user-generated content scenarios, this allows complete system compromise. The codebase relies heavily on dynamic parsing of metadata strings into JavaScript objects.

**Prevention:** Always use `node:vm`'s `runInNewContext` instead of `new Function` or `eval` when evaluating dynamic JavaScript or object literals. It provides an isolated context. Specifically, invoke it with an empty context (`Object.create(null)`) and an execution timeout (`{ timeout: 50 }`) to additionally prevent Denial of Service (DoS) attacks via infinite loops. When introducing Node.js built-ins to previously non-Node packages, always remember to add `"types": ["node"]` to `tsconfig.json`.