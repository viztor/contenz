## 2024-05-18 - Caching compiled RegExps in file scanning

**Learning:** The workspace repeatedly compiles identical regular expressions for filename parsing during project scanning because the RegExp objects were instantiated within the hot function `parseFileName`.
**Action:** Extract invariant RegExp instances and utilize a `WeakMap` for caching dynamically generated RegExps keyed by array references to eliminate redundant compilations and allocations.
