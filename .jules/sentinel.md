## 2024-07-18 - Path Traversal in writeContent
**Vulnerability:** Path traversal vulnerability in `writeContent` allows arbitrary file writes outside the intended collection directory by supplying a slug containing directory traversal characters (e.g., `../../`).
**Learning:** The vulnerability existed because the user-supplied slug was joined directly to the base path using `path.join()` without verifying if the resulting path escaped the base directory.
**Prevention:** To prevent this, always use `path.resolve()` on both the base path and the constructed path, and verify that the resulting file path strictly starts with the resolved base directory plus `path.sep`.
