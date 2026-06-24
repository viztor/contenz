## 2024-05-20 - [Performance] Cache regular expressions
**Learning:** Re-compiling regular expressions on every `parseFileName` call can cause a bottleneck if called repeatedly.
**Action:** Cache regular expressions generated from extension lists to avoid re-creating them on every file parse.
