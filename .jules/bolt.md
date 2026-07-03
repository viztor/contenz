## 2024-07-03 - RegExp Compilation Overhead in Content Parsing
**Learning:** During the parsing of content filenames (`parseFileName`), constructing a `RegExp` instance repeatedly causes significant performance overhead in tight loops (such as during bulk builds and generating items).
**Action:** Always cache dynamically generated `RegExp` objects (using a `Map` or similar data structure) with carefully constructed, collision-free cache keys when parsing files repeatedly. Ensure that cached RegExp objects don't use global (`g`) or sticky (`y`) flags to avoid maintaining state.
