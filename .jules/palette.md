## 2024-06-21 - Fix misleading affordances & add keyboard accessibility to cards
**Learning:** In the preview app, the `.card` class was globally given a pointer cursor and hover effects, even when used on non-interactive dashboard elements. Also, interactive navigation elements like `.nav-link` and `a.card` lacked keyboard `:focus-visible` outlines.
**Action:** Always scope interactive CSS states (`cursor: pointer`, `:hover`, `:focus-visible`) specifically to actionable elements (like `a.card`) rather than generic component wrappers, and ensure custom components define clear `:focus-visible` styles for keyboard users.
## 2024-07-11 - Add screen reader support to loading and error states
**Learning:** Pure CSS visual loading spinners (like `.loader-container`) and dynamically rendered error messages (like `.error-banner`) are completely invisible to screen readers unless explicitly marked with appropriate ARIA roles.
**Action:** Always add `role="status"` and `aria-label="Loading"` to loading containers, and `role="alert"` to error message containers to ensure they are immediately announced by assistive technologies.
