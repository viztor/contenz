## 2024-06-21 - Fix misleading affordances & add keyboard accessibility to cards
**Learning:** In the preview app, the `.card` class was globally given a pointer cursor and hover effects, even when used on non-interactive dashboard elements. Also, interactive navigation elements like `.nav-link` and `a.card` lacked keyboard `:focus-visible` outlines.
**Action:** Always scope interactive CSS states (`cursor: pointer`, `:hover`, `:focus-visible`) specifically to actionable elements (like `a.card`) rather than generic component wrappers, and ensure custom components define clear `:focus-visible` styles for keyboard users.

## 2024-06-22 - Make CSS loading spinners accessible
**Learning:** Pure CSS visual loading spinners (like `<div className="loader"></div>`) are completely invisible to screen readers, leaving users guessing if the app has frozen or is loading data.
**Action:** Always add `role="status"` and `aria-label="Loading"` to the container of purely visual loading indicators so assistive technologies can announce the loading state.
