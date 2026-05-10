## 2024-05-10 - Semantic color highlighting for CLI outputs
**Learning:** Using semantic color highlighting in the CLI terminal output (e.g. coloring keys cyan, values green, errors red, warnings yellow) vastly improves scannability for users when dealing with structured data and diagnostics compared to monochromatic text.
**Action:** Default to using `picocolors` to format all structured CLI outputs instead of just pretty printing plain text.
