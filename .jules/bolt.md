## 2025-01-30 - Cache RegExp in Hot Paths

**Learning:** In highly trafficked file processing loops (like `parseFileName`), repeatedly constructing dynamic `RegExp` instances and string concatenations (`extAlternation`) introduces measurable CPU and memory overhead.

**Action:** Cache regular expressions using stable references (like the `extensions` array, or fallback string primitives) as map keys to reuse regex instances across iterations, significantly reducing garbage collection pressure.
