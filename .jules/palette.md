## 2024-05-19 - Semantic Colors for CLI Output
**Learning:** Using semantic color highlighting in the CLI terminal (e.g., distinguishing structural keys from plain text or errors from warnings) significantly improves output scannability. This makes large blocks of structured data or error diagnostics much easier for users to quickly digest and parse.
**Action:** Use libraries like `picocolors` when printing structural data and diagnostics to the terminal. Highlight keys distinctively (e.g. cyan), errors distinctly (e.g. red), and sub-fields distinctly (e.g. yellow).
