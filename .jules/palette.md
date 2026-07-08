## 2024-06-21 - Fix misleading affordances & add keyboard accessibility to cards
**Learning:** In the preview app, the `.card` class was globally given a pointer cursor and hover effects, even when used on non-interactive dashboard elements. Also, interactive navigation elements like `.nav-link` and `a.card` lacked keyboard `:focus-visible` outlines.
**Action:** Always scope interactive CSS states (`cursor: pointer`, `:hover`, `:focus-visible`) specifically to actionable elements (like `a.card`) rather than generic component wrappers, and ensure custom components define clear `:focus-visible` styles for keyboard users.

## 2026-07-08 - Add accessibility roles to loading and error states
**Learning:** The frontend app's loading spinners () and error banners () lacked appropriate ARIA roles, making them invisible or unclear to screen reader users.
**Action:** For pure visual loading indicators, always add `role="status"` and an `aria-label` (e.g., "Loading"). For error messages or banners, always add `role="alert"` so they are immediately announced by screen readers.

## 2026-07-08 - Add accessibility roles to loading and error states
**Learning:** The frontend app's loading spinners ('.loader-container') and error banners ('.error-banner') lacked appropriate ARIA roles, making them invisible or unclear to screen reader users.
**Action:** For pure visual loading indicators, always add 'role="status"' and an 'aria-label' (e.g., "Loading"). For error messages or banners, always add 'role="alert"' so they are immediately announced by screen readers.
