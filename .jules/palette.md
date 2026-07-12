## 2024-06-21 - Fix misleading affordances & add keyboard accessibility to cards
**Learning:** In the preview app, the `.card` class was globally given a pointer cursor and hover effects, even when used on non-interactive dashboard elements. Also, interactive navigation elements like `.nav-link` and `a.card` lacked keyboard `:focus-visible` outlines.
**Action:** Always scope interactive CSS states (`cursor: pointer`, `:hover`, `:focus-visible`) specifically to actionable elements (like `a.card`) rather than generic component wrappers, and ensure custom components define clear `:focus-visible` styles for keyboard users.

## 2024-07-12 - Ensure screen reader accessibility for pure CSS loading spinners and error banners
**Learning:** Pure CSS loading spinners (like `.loader-container`) and dynamically rendered error banners (like `.error-banner`) are visually apparent but completely invisible or ignored by screen readers by default, leading to confusion during async operations.
**Action:** Always include `role="status"` and `aria-label="Loading"` on generic loading container elements, and ensure error/alert banners explicitly use `role="alert"` so they are immediately announced to screen reader users when they appear in the DOM.
