## 2024-07-24 - Path Traversal in writeContent
**Vulnerability:** The writeContent function in content-io.ts accepted unvalidated 'slug' input, which could contain directory traversal sequences (e.g., ../) allowing writing files outside the intended collection directory.
**Learning:** Path traversal vulnerabilities can occur when constructing file paths dynamically. Relying solely on path.join() is insufficient to prevent escaping the base directory.
**Prevention:** Always use path.resolve() on both the intended base directory and the constructed file path, then verify that the resolved file path strictly starts with the resolved base directory + path.sep.
