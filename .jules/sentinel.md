## 2024-05-18 - [Missing path validation in writeContent]

**Issue:** Path validation failed in writeContent allowing arbitrary files to be written outside the collection directory.
**Learning:** User provided slugs were concatenated directly with collection paths without normalization or bounds checking.
**Prevention:** Always normalize user-provided paths and verify they do not contain relative traversals or absolute path properties before using them in file system operations.
