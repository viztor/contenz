
## 2024-07-08 - Optimize `parseFileName` execution speed
**Learning:** `new RegExp()` instantiation inside critical hot path functions (like `parseFileName` called extensively during file processing) causes severe performance bottlenecks.
**Action:** Replace dynamic `RegExp` object creation with statically compiled regular expressions or native string manipulation methods (like `lastIndexOf`, `slice`, `includes`) to significantly boost performance.
