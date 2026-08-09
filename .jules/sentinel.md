## 2025-02-20 - Missing Path Validation
**Vulnerability:** Path validation failed in content creation allowing arbitrary paths.
**Learning:** Missing `path.posix.normalize` and directory checks allowed users to construct inputs that write to directories outside of the workspace or system bounds.
**Prevention:** Always normalize input paths using `path.posix.normalize()` and explicitly check for `.startsWith("..")` and absolute paths when constructing file paths from user inputs.
## 2025-02-20 - Unsafe Function.prototype.call in Output Functions
**Vulnerability:** Output utility functions (`fail`, `logError`) in `@contenz/cli` were invoked with `.call(this, ...)` despite taking the context as an explicit first argument, leading to unsafe execution and type mismatches that break builds.
**Learning:** Overriding `this` binding dynamically for exported module functions can break static analysis, type checking, and lead to unintended behavior, as `ContenzContext` must be passed as an explicit parameter.
**Prevention:** Invoke exported output functions directly (`fail(this, "message")`) passing the context explicitly, rather than using `Function.prototype.call`.
