## 2024-07-11 - Arbitrary Code Execution via `new Function` evaluating MDX metadata
**Vulnerability:** Found arbitrary code execution vulnerability where MDX metadata objects were evaluated using `new Function("return (" + objectStr + ")")`.
**Learning:** `new Function` can execute any valid Javascript, including requiring local modules and issuing system commands like reading files from `/etc/passwd`.
**Prevention:** Avoid evaluating Javascript strings entirely and use libraries like `json5` instead to parse stringified Javascript objects cleanly and safely.
