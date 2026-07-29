## 2024-07-29 - Path Traversal in writeContent
**Vulnerability:** A path traversal vulnerability existed in `writeContent` where an attacker could provide a malicious `slug` (e.g., `../../../../etc/passwd`) allowing them to write or overwrite files outside the intended collection directory.
**Learning:** Path traversal vulnerabilities occur when dynamic inputs are concatenated with file paths using `path.join` without proper sanitization or bounds checking. Node's `path.join` does not prevent traversing upwards from the base path.
**Prevention:** Always validate constructed file paths by resolving them absolutely using `path.resolve` and strictly checking that the resulting path is a sub-path of the intended, resolved base directory (using `startsWith`).
