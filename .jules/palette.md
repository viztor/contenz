
## 2024-06-10 - Misleading Interactive Cues & Keyboard Navigation
**Learning:** In the preview app, applying `cursor: pointer` and hover states (box-shadow/transform) globally to a `.card` class creates misleading affordances when the class is reused for non-interactive content (like static dashboard metrics). Additionally, custom UI elements (like cards and nav links) often miss `focus-visible` styles, hindering keyboard navigation visibility.
**Action:** Always scope interactive cursor and hover styles strictly to interactive elements (e.g., `a.card` or `button.card`), and ensure custom navigation or interactive components explicitly define `:focus-visible` outlines to guarantee keyboard accessibility.
