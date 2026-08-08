## 2024-08-08 - Optimized parseFileName to avoid dynamic RegExp compilation

**Learning:** In highly repetitive operations like file parsing across a workspace, instantiating `new RegExp` for every file is surprisingly expensive and a major bottleneck. Combining string manipulation (like `lastIndexOf` and `substring`) with static regexes dramatically reduces execution time. **Action:** Identify dynamic `new RegExp` creation inside hot paths or loops, and refactor them to use static cached regexes and native string methods where possible to improve performance.
