## 2025-03-05 - Fix missing path validation in writeContent
**Vulnerability:** User input slug was used to construct file paths without proper validation, leading to path validation failure.
**Learning:** Always validate that constructed file paths remain within the intended base directory, especially when incorporating user input.
**Prevention:** Use `path.relative()` to resolve paths and ensure they don't start with `..` and aren't absolute paths to safely contain them within the expected base directory.
