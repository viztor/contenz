
## 2025-02-05 - Path Traversal in File Operations
**Vulnerability:** Path traversal vulnerability via unsanitized slug input in `writeContent` allowing files to be written outside the intended directory.
**Learning:** Always normalize file paths and strictly enforce relative boundary checks (e.g., denying `../` or absolute paths) when concatenating user-supplied input to a base directory.
**Prevention:** Use functions like `path.posix.normalize` combined with boundary checks before file system operations.
