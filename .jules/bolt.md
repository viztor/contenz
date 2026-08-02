
## 2024-08-02 - Array Includes in Query Filter Loops
**Learning:** Using `Array.includes()` within `.filter()` for client-side queries creates an O(M*N) bottleneck. This codebase's data fetching/filtering does not optimize array-based operators by default.
**Action:** Always convert array values to `Set` instances outside of iterative filter loops to achieve O(1) lookups for `in` and `not-in` operations.
