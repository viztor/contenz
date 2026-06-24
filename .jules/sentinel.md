## 2026-06-24 - Arbitrary Code Execution via object evaluation
**Vulnerability:** Evaluating dynamic metadata object literals using `new Function` in MDX files.
**Learning:** `new Function` allows arbitrary code execution. It should be avoided for evaluating metadata that might be externally sourced or unverified.
**Prevention:** Use `json5` to safely parse JS object literal syntax.
