## 2025-02-18 - Prevent Arbitrary Code Execution in MDX Adapter
**Vulnerability:** Arbitrary Code Execution via `new Function` in `@contenz/adapter-mdx` to parse metadata from MDX files.
**Learning:** `new Function` is inherently unsafe as it executes arbitrary JavaScript code. When parsing metadata structures, using code evaluation is dangerous and can lead to ACE vulnerabilities if the input is untrusted or maliciously crafted.
**Prevention:** Use a safer alternative like `json5` which can parse loose JSON/JS object literals safely without executing code. Never use `new Function` or `eval` for parsing configurations or metadata.
