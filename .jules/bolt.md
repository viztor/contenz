## 2024-05-24 - Do not escape RegExp literals when caching
**Learning:** When applying performance optimizations via caching, if the original code uses RegExp literals, they must be preserved exactly as they are. Attempting to string-escape them inside a search/replace diff breaks the character classes (e.g., changing `/[\]\\]/` to `/[\\]\\\\]/`).
**Action:** When creating caching mechanisms for RegExp literals, copy the exact regex patterns verbatim from the original implementation without altering any backslashes or escape characters.
