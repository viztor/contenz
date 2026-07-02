
## 2026-07-02 - RegExp Compilation Caching
**Learning:** In highly called utility functions (like filename parsing during build), repeated \`new RegExp\` instantiation with dynamic strings can add up to significant overhead. We can cache these instances for reuse.
**Action:** When caching compiled \`RegExp\` objects in a \`Map\` for performance reuse, ensure they do not use the global (\`g\`) or sticky (\`y\`) flags, as these maintain a \`lastIndex\` state across executions which would make them unsafe to reuse across multiple calls.
