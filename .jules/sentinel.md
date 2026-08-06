## 2025-02-23 - Path Traversal in writeContent
**Vulnerability:** Path traversal vulnerability in `writeContent` function in `packages/core/src/content-io.ts` allowing writing arbitrary files via user-supplied slug.
**Learning:** Using `path.join` to construct file paths with user input allows directory traversal attacks (`../`).
**Prevention:** Use `path.resolve` for path construction and strictly verify that the normalized output path starts with the expected base directory plus a path separator.
