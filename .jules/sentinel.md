## 2025-02-27 - Path Traversal in File Write
**Vulnerability:** Path traversal in `writeContent` allowed writing to arbitrary locations using `../` in slugs.
**Learning:** `path.join` does not prevent directory traversal when combined with uncontrolled input.
**Prevention:** Always use `path.resolve` and verify that the resolved target path strictly starts with the resolved base directory plus a path separator.
