## 2025-02-20 - Missing Path Validation
**Vulnerability:** Path validation failed in content creation allowing arbitrary paths.
**Learning:** Missing `path.posix.normalize` and directory checks allowed users to construct inputs that write to directories outside of the workspace or system bounds.
**Prevention:** Always normalize input paths using `path.posix.normalize()` and explicitly check for `.startsWith("..")` and absolute paths when constructing file paths from user inputs.
