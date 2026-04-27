## 2024-04-27 - [Arbitrary Code Execution via new Function]
**Vulnerability:** Found the use of `new Function` in `packages/adapter-mdx/src/index.ts` to evaluate dynamic object literals for MDX frontmatter. This could potentially allow arbitrary code execution if user input is injected into the MDX string.
**Learning:** `new Function` runs code in the global scope without restrictions. Using this on untrusted inputs creates a security risk. In environments where dynamic evaluation is absolutely necessary for object literals, it must be restricted.
**Prevention:** Replaced `new Function` with `vm.runInNewContext(..., Object.create(null), { timeout: 1000 })` to execute the code safely inside a restricted and empty context, adding a timeout for denial-of-service protection.
