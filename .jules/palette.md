## 2024-06-21 - Fix misleading affordances & add keyboard accessibility to cards
**Learning:** In the preview app, the `.card` class was globally given a pointer cursor and hover effects, even when used on non-interactive dashboard elements. Also, interactive navigation elements like `.nav-link` and `a.card` lacked keyboard `:focus-visible` outlines.
**Action:** Always scope interactive CSS states (`cursor: pointer`, `:hover`, `:focus-visible`) specifically to actionable elements (like `a.card`) rather than generic component wrappers, and ensure custom components define clear `:focus-visible` styles for keyboard users.
## 2024-07-19 - Ensure accessibility for loading spinners and error banners
**Learning:** Purely visual components like loading spinners (`.loader-container`) and error banners (`.error-banner`) are completely invisible to screen readers without proper roles.
**Action:** Always add `role="status"` and `aria-label="Loading"` to loading spinners, and `role="alert"` to error messages or banners so they are announced by assistive technologies.
