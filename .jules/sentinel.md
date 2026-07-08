
## 2026-07-08 - Fix Arbitrary Code Execution in MDX Parser
**Vulnerability:** Arbitrary Code Execution (RCE) via `new Function(...)` when parsing MDX metadata.
**Learning:** The MDX parser extracted `export const meta = { ... }` using a brace scanner and then evaluated it using `new Function(...)`. This allows attackers to execute arbitrary code if they control the MDX content.
**Prevention:** Use `JSON5.parse` to safely parse Javascript object literal syntax instead of evaluating it with `new Function` or `eval`.
