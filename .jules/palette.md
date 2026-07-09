## 2024-06-21 - Fix misleading affordances & add keyboard accessibility to cards
**Learning:** In the preview app, the `.card` class was globally given a pointer cursor and hover effects, even when used on non-interactive dashboard elements. Also, interactive navigation elements like `.nav-link` and `a.card` lacked keyboard `:focus-visible` outlines.
**Action:** Always scope interactive CSS states (`cursor: pointer`, `:hover`, `:focus-visible`) specifically to actionable elements (like `a.card`) rather than generic component wrappers, and ensure custom components define clear `:focus-visible` styles for keyboard users.
## 2024-07-09 - Accessible loading spinners and error banners
**Learning:** Pure CSS visual loading spinners (`.loader-container`) and generic error message banners (`.error-banner`) in the preview app lacked accessible roles, rendering their active states invisible to screen reader users.
**Action:** Always include `role="status"` and `aria-label="Loading"` on visual loader containers, and `role="alert"` on dynamically rendered error banners to ensure they are immediately announced by screen readers.
