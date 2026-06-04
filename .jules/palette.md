## 2024-06-04 - Semantic Loaders and Empty States
**Learning:** Decorative icons from `lucide-react` need explicit `aria-hidden="true"` to prevent screen readers from announcing them needlessly. For stateful UI regions (like loaders or error states), using proper `role="status"` or `role="alert"` combined with `aria-label` provides a much better experience for screen reader users than bare `<div>` elements.
**Action:** When adding or updating React components, always verify if icons are purely decorative and add `aria-hidden`. Ensure loading states provide semantic context through ARIA roles.
