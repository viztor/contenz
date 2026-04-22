## 2024-05-18 - Caching compiled Regular Expressions in core parsers
**Learning:** Core content parsers (like `packages/core/src/parser.ts`) compile Regexes matching custom schema configuration for *every* parsed file, which creates overhead for projects with many content files. Using a module-level `Map` cache bounded by schema keys yields large relative gains.
**Action:** When working on parsing loops, look for opportunities to memoize or cache repeatedly-compiled `RegExp` patterns, especially those built from configuration strings.
