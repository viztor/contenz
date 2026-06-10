## 2024-06-10 - Cache Dynamic RegExp in Hot Loops
**Learning:** In the core parsing engine, calling `new RegExp()` repeatedly in hot loops (like `parseFileName` which processes every file during builds) causes unnecessary allocation and computation overhead.
**Action:** When dynamically constructing regular expressions based on config parameters (like `extensions` or `i18nEnabled`), always pre-compute standard defaults and cache the generated `RegExp` objects (e.g., using a `Map`) keyed by their dynamic inputs.
