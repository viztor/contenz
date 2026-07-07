## 2024-06-25 - Replace dynamic RegExp with string manipulation for hot paths
**Learning:** Instantiating `RegExp` objects dynamically inside hot-path functions (like `parseFileName` when bulk processing files) creates severe overhead. By replacing this with standard string operations (`lastIndexOf`, `slice`) and static pre-compiled regex for simple validation only, execution time was cut by over 10x in benchmarks.
**Action:** Always prefer standard string manipulation (`lastIndexOf`, `slice`, `includes`) or statically compiled, reused regexes inside hot-path iteration loops.
