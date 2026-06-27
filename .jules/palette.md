## 2024-06-21 - Fix misleading affordances & add keyboard accessibility to cards
**Learning:** In the preview app, the `.card` class was globally given a pointer cursor and hover effects, even when used on non-interactive dashboard elements. Also, interactive navigation elements like `.nav-link` and `a.card` lacked keyboard `:focus-visible` outlines.
**Action:** Always scope interactive CSS states (`cursor: pointer`, `:hover`, `:focus-visible`) specifically to actionable elements (like `a.card`) rather than generic component wrappers, and ensure custom components define clear `:focus-visible` styles for keyboard users.

## 2024-06-27 - Accessible Pure CSS Spinners
**Learning:** Pure CSS visual loading spinners (like `.loader-container` in `@contenz/preview`) are invisible to screen readers unless explicitly marked.
**Action:** Always include `role="status"` and `aria-label="Loading"` on the container element for pure CSS loading indicators to ensure they are properly announced to assistive technologies.
