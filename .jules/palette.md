## 2024-06-11 - Scope interactive states strictly to semantic interactive elements

**Learning:** When using generalized container components like `.card` that can act as both static display wrappers and interactive links (`a.card`), applying interactive CSS states (like `cursor: pointer` or hover effects) to the base `.card` class creates misleading affordances on the static variants.

**Action:** Always scope interactive CSS states (`cursor: pointer`, `:hover`, `:active`) and accessibility outlines (`:focus-visible`) strictly to the semantic interactive element tag (e.g., `a.card` instead of `.card`). Ensure custom interactive components have explicit `:focus-visible` styles with a sufficient `outline-offset` to guarantee keyboard accessibility.
