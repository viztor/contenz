## 2024-06-21 - Fix misleading affordances & add keyboard accessibility to cards
**Learning:** In the preview app, the `.card` class was globally given a pointer cursor and hover effects, even when used on non-interactive dashboard elements. Also, interactive navigation elements like `.nav-link` and `a.card` lacked keyboard `:focus-visible` outlines.
**Action:** Always scope interactive CSS states (`cursor: pointer`, `:hover`, `:focus-visible`) specifically to actionable elements (like `a.card`) rather than generic component wrappers, and ensure custom components define clear `:focus-visible` styles for keyboard users.
## 2024-07-10 - Accessible Spinners and Banners
**Learning:** Pure CSS loading spinners and custom error banners are not naturally announced by screen readers. While visual users see the spinner or banner, assistive technologies ignore them, leaving users unaware of the state.
**Action:** Always add `role="status"` and `aria-label="Loading"` to loading spinners, and `role="alert"` to error banners to ensure immediate announcements to assistive tech.
