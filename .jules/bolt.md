## 2024-08-01 - Parallelize File Parsing in Build Step
**Learning:** Sequential file parsing inside `processOneCollection` in `packages/core/src/run-build.ts` acts as a bottleneck for large collections and async `computeFn` fields.
**Action:** Use `pMap` concurrency as the standard for file loops to avoid N+1 bottlenecks.
