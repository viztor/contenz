## 2024-07-22 - Path Traversal in writeContent
**Vulnerability:** Path traversal possible by passing a slug like `../../../../../tmp/pwned` to `writeContent`.
**Learning:** `path.join` does not prevent path traversal. If a dynamic component starts with `..`, it can escape the intended directory.
**Prevention:** Always use `path.resolve` on the base directory and the joined path, and then check if the resulting path strictly `startsWith(resolvedBaseDir + path.sep)`.
