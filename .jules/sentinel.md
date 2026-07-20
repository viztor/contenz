## 2024-07-20 - Fix Path Traversal in writeContent
**Vulnerability:** Path traversal in `writeContent` due to relying on `path.join` with unsanitized user input (`slug`), allowing writing to arbitrary files (e.g. `/tmp/pwned.md`).
**Learning:** `path.join` alone does not protect against `../` path traversal sequences.
**Prevention:** Always use `path.resolve` for the base directory and the target path, then strictly check that the target path starts with the base directory path followed by a path separator (`path.sep`), or exactly equals the base directory (if it's a file, though usually it's in a dir).
