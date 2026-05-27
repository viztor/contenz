## 2024-05-27 - [CLI Output Colorization]
**Learning:** Node.js native `util.inspect` with `{ colors: true, depth: null }` provides robust, zero-dependency semantic color highlighting for complex nested JSON structures in the terminal, which significantly improves developer UX compared to manual pretty-printing without colors.
**Action:** Default to using `node:util`'s `inspect` with `{ colors: true }` for structured CLI outputs instead of manual recursion or adding external color dependencies like `picocolors`.
