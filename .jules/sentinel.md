## 2026-06-29 - Arbitrary Code Execution via new Function()
**Vulnerability:** The `safeEvalObjectLiteral` function in `@contenz/adapter-mdx` was using `new Function()` to parse JavaScript object literal strings for MDX metadata (`export const meta = { ... }`). This is a classic Remote Code Execution (RCE) / Code Injection vector if untrusted MDX files are processed.
**Learning:** The previous implementation likely used `new Function()` for convenience because the object literal syntax (`{ key: "value" }`) without quotes around keys isn't strictly valid JSON.
**Prevention:** Avoid `new Function` or `eval` for parsing any data, even data that looks like code. Use a safe parser like `json5` which correctly handles JavaScript object literal syntax without executing arbitrary code.
