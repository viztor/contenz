## 2024-05-24 - Missing Path Validation

**Issue:** Missing path validation
**Learning:** The path.startsWith check incorrectly allowed malicious paths.
**Prevention:** Always normalize the path.
