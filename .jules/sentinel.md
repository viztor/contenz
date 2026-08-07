## 2024-05-15 - Missing Path Validation in writeContent

**Vulnerability:** The slug parameter in writeContent lacked boundary validation, permitting writes outside the collection directory.
**Learning:** Path boundaries can be breached in programmatic content creation functions if inputs are joined with base paths without validation. The `isProjectRelativePath` helper in `sources.ts` does not cover runtime file creation.
**Prevention:** Always normalize and validate slugs to ensure they are strictly relative and do not contain `../` or `..` segments before using them in `path.join`.
