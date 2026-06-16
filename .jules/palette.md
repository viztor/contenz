## 2024-06-16 - Scoping Interactive CSS Cursors
**Learning:** Generic layout components (like `.card`) shouldn't have `cursor: pointer` or interactive hover effects globally. They are often used for display-only stats (like on a Dashboard). This creates misleading affordances for users.
**Action:** Scope interactive CSS cursor and hover styles strictly to interactive elements (e.g., `a.card` instead of `.card`) and explicitly define `:focus-visible` outlines for custom interactive components to guarantee keyboard accessibility.
