## 2024-05-25 - Terminal Color Semantic Output
**Learning:** For a backend/CLI tool, UX improvements are mostly related to developer experience (DX). Console output without structure and highlighting can be hard to parse at a glance.
**Action:** Always consider using lightweight semantic coloring (via `picocolors`) when printing structured data (objects/arrays) or diagnostics in the CLI terminal to distinguish structural keys and critical information from plain text.
