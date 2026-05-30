
## 2024-05-30 - Semantic Colors in CLI Output
**Learning:** For a backend/CLI tool like Contenz, standard UI UX patterns (like ARIA attributes) aren't applicable. However, developer experience (DX) is a critical form of UX. Relying on basic `console.log` for nested structured data leads to hard-to-read, unformatted output.
**Action:** When printing complex structured objects to the terminal, use Node's native `node:util` `inspect` method with `{ colors: true, depth: null }` instead of building custom `prettyPrint` functions. It provides built-in semantic coloring, properly handles arbitrary nesting, and avoids bringing in external dependencies like `picocolors`.
