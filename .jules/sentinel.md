## 2024-11-20 - [Arbitrary Code Execution in MDX Meta Extraction]
**Vulnerability:** Found `new Function` being used to dynamically evaluate JS object literals inside MDX frontmatter parsing in `@contenz/adapter-mdx`.
**Learning:** `new Function` (and `eval`) can lead to Arbitrary Code Execution (ACE) if an attacker can inject malicious javascript into MDX files.
**Prevention:** Replaced `new Function` with `node:vm`'s `runInNewContext()`, strictly configured with an empty context (`Object.create(null)`) and an execution timeout (`{ timeout: 1000 }`), preventing access to the global scope and preventing potential infinite loops (DoS).
