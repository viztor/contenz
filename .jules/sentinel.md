## 2024-07-16 - Path Traversal in Content Creation
**Vulnerability:** The `writeContent` function in `@contenz/core` allows arbitrary file writes via a path traversal vulnerability in the `slug` parameter (e.g., `../../../tmp/pwned`).
**Learning:** Using `path.join()` without bounds checking on user input (`slug`) permits writing files outside the intended collection directory.
**Prevention:** Always validate that dynamic paths resolve to a path strictly within the intended base directory using `path.resolve()` on both and checking `resolvedFilePath.startsWith(resolvedBaseDir + path.sep)`.
