## 2024-05-18 - Avoid repeated RegExp compilation in file iterations

**Learning:** Instantiating new \`RegExp\` objects inside a loop or frequently called function (like \`parseFileName\`) creates a significant performance bottleneck during build-time file scanning. **Action:** Always extract invariant regular expressions outside of loops, or cache them in a \`Map\` keyed by their configuration arguments when the pattern is dynamic.
