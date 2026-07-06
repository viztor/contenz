## 2024-06-21 - Fix misleading affordances & add keyboard accessibility to cards
**Learning:** In the preview app, the `.card` class was globally given a pointer cursor and hover effects, even when used on non-interactive dashboard elements. Also, interactive navigation elements like `.nav-link` and `a.card` lacked keyboard `:focus-visible` outlines.
**Action:** Always scope interactive CSS states (`cursor: pointer`, `:hover`, `:focus-visible`) specifically to actionable elements (like `a.card`) rather than generic component wrappers, and ensure custom components define clear `:focus-visible` styles for keyboard users.

## 2024-07-06 - Accessible dynamic loading and error states
**Learning:** Pure CSS loading spinners (like `.loader-container`) and dynamically rendered error banners (like `.error-banner`) in React apps are visually apparent but completely silent to screen readers by default.
**Action:** Always add `role="status"` and `aria-label="Loading"` to generic loader container elements, and add `role="alert"` to dynamically rendered error banners to ensure critical application state changes are immediately announced to assistive technologies.
