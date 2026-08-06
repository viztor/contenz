## 2024-08-06 - Path Traversal bypass in project path validation
**Vulnerability:** The `isProjectRelativePath` function didn't normalize paths before checking them, allowing bypasses like `foo/../../etc/passwd`.
**Learning:** Checking for `../` at the start of a string is insufficient if the path hasn't been normalized first, because nested traversal segments can evade the simple string check.
**Prevention:** Always use `path.posix.normalize()` on paths before performing string-based security checks.
