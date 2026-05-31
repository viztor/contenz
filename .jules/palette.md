## 2024-05-31 - Semantic Color Output in CLI
**Learning:** For Node.js CLI tools, developers heavily rely on terminal colors to quickly parse structured data and error diagnostics. A custom pretty-print function without syntax highlighting slows down debugging.
**Action:** Use Node's native `util.inspect({ colors: true })` for logging objects and arrays instead of custom implementations, and use standard ANSI escape codes for coloring specific words like "Error:" without needing external dependencies like `picocolors`.
