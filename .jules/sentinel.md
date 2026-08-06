## 2024-07-14 - Fix Path Traversal in Content IO
**Vulnerability:** A path traversal vulnerability existed in `writeContent` function in `packages/core/src/content-io.ts`. The `slug` variable was passed unsanitized into `path.join`, allowing arbitrary file write outside the intended collection directory.
**Learning:** `path.join` does not resolve paths absolutely or check boundaries, making it susceptible to `../../` sequences. Dynamic file paths constructed from user input must be validated.
**Prevention:** Always use `path.resolve` on both the intended base directory and the constructed file path, then verify that the resolved file path strictly starts with the resolved base directory + `path.sep` (or matches it exactly) before proceeding with file system operations.
