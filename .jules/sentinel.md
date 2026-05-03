## 2024-03-05 - Arbitrary Code Execution via `new Function`
**Vulnerability:** Arbitrary code execution vulnerability via the use of `new Function()` when evaluating Javascript object literals in the MDX adapter (`@contenz/adapter-mdx`).
**Learning:** Using `new Function` or `eval` opens up arbitrary code execution vulnerabilities by executing string inputs. `node:vm` mitigates this effectively by running code inside a sandboxed VM execution context.
**Prevention:** Use `runInNewContext` from `node:vm` with an empty context (`Object.create(null)`) and an execution timeout when evaluating dynamic JavaScript or object literals, ensuring they are executed securely and safely.
