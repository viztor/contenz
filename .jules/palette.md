## 2024-06-21 - Fix misleading affordances & add keyboard accessibility to cards
**Learning:** In the preview app, the `.card` class was globally given a pointer cursor and hover effects, even when used on non-interactive dashboard elements. Also, interactive navigation elements like `.nav-link` and `a.card` lacked keyboard `:focus-visible` outlines.
**Action:** Always scope interactive CSS states (`cursor: pointer`, `:hover`, `:focus-visible`) specifically to actionable elements (like `a.card`) rather than generic component wrappers, and ensure custom components define clear `:focus-visible` styles for keyboard users.

## 2026-07-05 - Add ARIA roles to pure CSS loading spinners
**Learning:** In the preview app, loading states used pure CSS spinners (`.loader-container`) without any screen reader context, making the pending states invisible to assistive technologies.
**Action:** For pure CSS visual loading spinners in the application, always include `role="status"` and `aria-label="Loading"` on the container element to ensure they are accessible to screen readers.
