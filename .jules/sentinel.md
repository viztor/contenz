## 2024-05-24 - Missing path validation in file writes

**Issue:** Missing path validation allowed writing content outside the intended directory via crafted slugs. **Learning:** File paths derived from user input (like slugs) must be validated after path joining, as path.join resolves ../ sequences which can escape the base directory. **Prevention:** Always normalize the path relative to the base directory and check that it does not start with ../ and is not absolute.
