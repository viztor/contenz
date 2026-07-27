## 2024-05-24 - Path Traversal bypass via non-normalized paths
**Vulnerability:** The `isProjectRelativePath` check allowed path traversal strings like `docs/../../etc/passwd` because it only checked if the unnormalized path started with `../`.
**Learning:** Checking for path traversal (`../`) without first normalizing the path is insufficient and easily bypassed using nested traversal segments.
**Prevention:** Always normalize the path string (e.g., using `path.posix.normalize` or `path.normalize`) before verifying whether it attempts to escape the root directory with `../`.
