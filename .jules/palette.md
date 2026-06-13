## 2024-06-13 - Scope interactive styles for accurate affordances

**Learning:** Applying interactive styles like `cursor: pointer` or hover transforms to non-interactive container elements (like generic `.card` divs) creates misleading affordances for users, especially those using assistive technologies. Additionally, missing `:focus-visible` styles on custom components hinders keyboard navigation.
**Action:** Always scope interactive CSS cursor and hover styles strictly to interactive elements (e.g., `a.card` instead of `.card`). Explicitly define `:focus-visible` outlines for custom interactive elements to guarantee keyboard accessibility.
