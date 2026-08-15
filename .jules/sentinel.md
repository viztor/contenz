## 2024-10-24 - Missing Path Validation

**Vulnerability:** Path validation was missing in `writeContent` allowing arbitrary file writes outside the content collections directory via manipulated slugs. **Learning:** Slugs must be validated to ensure they resolve within the expected directory, especially since `path.join` allows navigating upwards. **Prevention:** Always validate constructed file paths using `path.relative` and checking against `..` or absolute paths before writing files.
