## 2024-06-25 - Avoid Dynamic RegExp in Hot Loops
**Learning:** Recompiling Regular Expressions on every file parsed causes unnecessary overhead, especially when parsing files in a hot loop within `@contenz/core`'s file parser.
**Action:** Always extract and cache compiled `RegExp` patterns into a `Map` or at the module level when dynamic patterns (like extensions or locales) are reused across many operations.
