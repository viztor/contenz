## 2024-07-15 - Path Traversal in writeContent
**Vulnerability:** User-controlled slug in writeContent could be used to write files outside the intended collection directory.
**Learning:** Using path.join with user input without validating the resolved path allows directory escape via ../ sequences.
**Prevention:** Always use path.resolve on both the base directory and the constructed file path, then verify that the resolved file path strictly starts with the resolved base directory + path.sep.
