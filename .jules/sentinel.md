## 2025-08-02 - Prevent writing content outside collection directories
**Vulnerability:** A missing path boundary check in `writeContent` allowed writing to arbitrary locations using `../` in content slugs.
**Learning:** `path.join` alone does not validate path boundaries.
**Prevention:** Always normalize the slug input and validate that the resolved output path strictly starts with the resolved target directory path (using `path.resolve` and `path.sep`) when using unvalidated input strings like slugs to construct paths.
