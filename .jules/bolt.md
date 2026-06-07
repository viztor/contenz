## 2024-05-15 - [RegExp Re-creation in Hot Loops]
**Learning:** Instantiating new RegExp objects inside hot loops (like `parseFileName` which processes every file during a build) introduces a measurable performance bottleneck. The JavaScript engine must compile the regular expression each time.
**Action:** Always cache compiled `RegExp` objects outside the function or in a `Map` keyed by dynamic inputs (e.g., `extensions` or `i18n` flags) if they must be constructed at runtime.
