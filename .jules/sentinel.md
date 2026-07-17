## 2024-07-17 - Fix Path Traversal in Content IO
**Vulnerability:** Path traversal vulnerability in `writeContent` allowed malicious slugs to write files outside of the intended collection directory.
**Learning:** `path.join` does not protect against directory traversal payloads like `../`. Input used in file path construction must be validated.
**Prevention:** Always validate that resolved dynamic file paths strictly start with the resolved base directory + `path.sep` using `path.resolve()` when writing files.
