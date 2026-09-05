## 2025-01-24 - Enhance MDX metadata evaluation robustness

**Issue:** The MDX adapter evaluated user-provided metadata strings using `new Function()`, which evaluates in the global context and can behave unpredictably with unvalidated strings.
**Learning:** Sandboxing JavaScript evaluation requires using dedicated modules like `node:vm` rather than relying on `new Function()` or `eval()` which run in the global context.
**Prevention:** Use `node:vm.runInNewContext(code, Object.create(null))` for evaluating stringified JavaScript objects or literals safely.
