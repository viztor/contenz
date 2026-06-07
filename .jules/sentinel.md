## 2026-06-07 - Arbitrary Code Execution via new Function

**Vulnerability:** Arbitrary Code Execution (ACE) in `packages/adapter-mdx/src/index.ts` where `new Function` was used to evaluate MDX metadata objects.
**Learning:** Evaluating untrusted object literal strings using `new Function` can execute arbitrary code within the node environment.
**Prevention:** Replaced `new Function` with `JSON5.parse()` to safely parse the object literal string without executing it. `JSON5` supports standard JavaScript object literal features like unquoted keys and single quotes while remaining safe.
