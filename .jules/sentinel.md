## 2024-05-24 - Path Traversal in Content Creation
**Vulnerability:** Path traversal in `writeContent` where user-provided `slug` input is interpolated into a file path, allowing arbitrary file creation outside the collection directory.
**Learning:** Functions that generate paths using user inputs like `slug` must perform strict path boundary checks to prevent traversal.
**Prevention:** Use `path.resolve()` on both the base directory and the intended file path, then verify that the resolved file path strictly starts with the resolved base directory + `path.sep`.
