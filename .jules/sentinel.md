## 2024-07-21 - Fix arbitrary code execution in MDX adapter
**Vulnerability:** MDX adapter used `new Function` to parse export meta blocks, leading to arbitrary code execution if a malicious actor controls MDX content.
**Learning:** `new Function` evaluates strings as JavaScript in the global scope. Using it to parse unsanitized data (even object literals) is an RCE risk.
**Prevention:** Use `node:vm` `runInNewContext` to evaluate code in a sterile, isolated sandbox instead of the global scope.
