## 2024-05-24 - Cross-Platform Path Validation

**Issue:** Missing path validation allowed Windows absolute paths (e.g. `C:/`) to bypass directory traversal checks, permitting arbitrary file access.
**Learning:** Standard POSIX segment splitting does not inherently reject Windows drive letters.
**Prevention:** Always implement explicit checks for cross-platform edge cases, such as drive letters, especially when working in edge-safe contexts where `node:path` is unavailable.
