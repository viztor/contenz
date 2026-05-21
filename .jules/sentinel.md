## 2024-05-21 - Arbitrary Code Execution via new Function
**Vulnerability:** Arbitrary code execution vulnerability in the MDX parser (`safeEvalObjectLiteral`) due to the use of `new Function` for parsing JavaScript object literals in MDX files.
**Learning:** For environment-agnostic packages (like MDX adapters that run in edge/browser), `json5` or an AST parser should be used instead of `new Function` or `node:vm` to parse JavaScript object literals, preventing potential RCE and maintaining compatibility.
**Prevention:** Avoid `new Function` or `eval` when evaluating dynamic JavaScript or object literals, especially from potentially untrusted inputs. Use secure alternatives like `json5`.
