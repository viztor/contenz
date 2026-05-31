## 2024-05-31 - [Performance] Cache regular expressions in filename parser
**Learning:** Creating `RegExp` objects dynamically in a hot loop (like `parseFileName` which processes many content files) introduces a substantial performance bottleneck in the build process.
**Action:** When regular expressions depend on variables but are constructed repeatedly, use a `Map` keyed by those variables to cache and reuse the compiled `RegExp` instances, reducing overhead significantly.
