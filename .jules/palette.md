## 2024-05-09 - CLI Output Scannability Improvement
**Learning:** Terminal outputs (like CLI diagnostic errors) can be hard to scan when everything is uniform. Adding semantic color highlighting specifically for structured keys and critical information improves immediate readability and reduces cognitive load during development.
**Action:** Use `picocolors` to highlight keys (e.g., cyan) and errors (e.g., red) in structural CLI output like JSON-equivalent pretty prints.
