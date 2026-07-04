## 2024-07-04 - [Arbitrary Code Execution in MDX Adapter]
**Vulnerability:** Arbitrary Code Execution (RCE) via `new Function()` in `packages/adapter-mdx/src/index.ts`.
**Learning:** The `@contenz/adapter-mdx` package used `new Function('return (' + objectStr + ');')` to parse the `export const meta = { ... }` block in `.mdx` files. If an attacker crafts a malicious `.mdx` file, they could execute arbitrary code when the content gets built.
**Prevention:** Always use safe parsers like `JSON5.parse` to parse JavaScript object literal syntax instead of `eval()` or `new Function()`.
