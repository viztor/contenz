## 2023-10-24 - Path normalization bypass in project paths

**Vulnerability:** Path boundary checks failed to normalize paths before evaluation, allowing malformed boundary crossing paths to bypass security checks.
**Learning:** Normalizing a path and validating it must be tightly coupled. Evaluating conditions on the raw input while using the normalized output later allows boundary escapes.
**Prevention:** Always apply path normalization first, and perform all boundary checks exclusively against the normalized variable.
