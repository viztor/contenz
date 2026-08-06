## 2024-07-31 - Path Traversal in File Creation
**Vulnerability:** Path traversal vulnerability in `writeContent` function via user-provided `slug` escaping the collection directory.
**Learning:** Joining unvalidated user input (like a slug) to a base path can lead to arbitrary file writes if the input contains `../`.
**Prevention:** Always normalize the input and resolve paths, then check if the resulting absolute path starts with the expected base directory (e.g. `filePath.startsWith(basePath + path.sep)`).
