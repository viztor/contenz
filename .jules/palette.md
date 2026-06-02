## 2024-06-02 - Semantic color highlighting for CLI output
**Learning:** Semantic color highlighting improves readability in the CLI terminal output without needing external dependencies like `picocolors`. Node's native `util.inspect` handles infinite depth and coloration easily.
**Action:** Use `inspect(data, { colors: true, depth: null })` when formatting complex configuration/JSON data in terminal logs instead of manual nesting strings.
