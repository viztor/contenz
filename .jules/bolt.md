## 2024-04-23 - [Cache dynamically created RegExps in hot paths]
**Learning:** [Repeatedly calling `new RegExp(...)` with a dynamic string inside hot paths (e.g., parsing hundreds or thousands of file names) creates significant overhead. Caching the compiled regex object based on the parameters required to build it reduces parsing time significantly in repetitive tasks.]
**Action:** [When using dynamic regexes in performance critical areas, create a Map to cache and reuse the compiled `RegExp` based on the construction parameters.]
