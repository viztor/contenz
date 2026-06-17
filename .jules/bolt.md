## 2024-05-26 - Regex Compilation in Hot Loops
**Learning:** Recompiling Regular Expressions on every file parse in `packages/core/src/parser.ts` creates a performance bottleneck during large builds, as string parsing functions are called frequently in hot loops.
**Action:** Always cache compiled `RegExp` objects outside the function or in a `Map` keyed by dynamic inputs (like file extensions) to reuse them across invocations.
