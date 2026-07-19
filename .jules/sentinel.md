## 2024-05-18 - Enforce directory boundaries in file writes
**Vulnerability:** The writeContent function allowed dynamic file paths to traverse outside the intended collection directory by directly joining user-provided slugs.
**Learning:** Using path.join() with dynamic slugs does not prevent writing outside the intended base directory.
**Prevention:** Use path.resolve() on both the intended base directory and the constructed file path, then verify that the resolved file path strictly starts with the resolved base directory + path.sep.
