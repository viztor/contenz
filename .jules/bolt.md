
## 2024-07-31 - Optimize in/not-in query operators
**Learning:** In the client QueryBuilder, `in` and `not-in` operator queries were doing an O(N) array `includes` lookup on every item in the dataset, leading to O(N*M) performance bottlenecks for large datasets.
**Action:** Always convert filter target arrays to a `Set` before iterating over large datasets to ensure O(1) lookups per item.
