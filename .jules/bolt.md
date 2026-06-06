## 2024-06-06 - Cache compiled RegExp in hot loops
**Learning:** Instantiating `RegExp` objects inside hot loops, like the filename parser `parseFileName` which can run thousands of times during a build, creates measurable performance overhead.
**Action:** When a regular expression is dynamic but derived from a small set of possible input combinations (e.g., `i18nEnabled` and `extensions`), compile it once and cache it in a `Map` so subsequent executions can reuse the compiled pattern instead of recompiling it repeatedly.
