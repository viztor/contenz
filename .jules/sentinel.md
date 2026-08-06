## 2025-02-27 - Path Traversal in File Creation
**Vulnerability:** The `writeContent` function in `content-io.ts` concatenated unsanitized user input (`slug`) directly into file paths using `path.join`, allowing arbitrary file writes outside the intended collection directory.
**Learning:** Always resolve and validate dynamic file paths before writing to them to ensure they fall strictly within expected base directories.
**Prevention:** Use `path.resolve()` on both the base directory and the target file path, and verify that the target path starts with the base path (e.g., `if (!filePath.startsWith(baseDir + path.sep))`).
