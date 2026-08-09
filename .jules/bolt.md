## 2024-08-09 - RegExp instantiation in inner loop

**Learning:** Re-instantiating `new RegExp()` in a frequently called function (`parseFileName`) caused unnecessary overhead, as measured by a ~30% performance regression over iterations. Caching these objects significantly reduces string-matching time in bulk processing scenarios. **Action:** Extract and cache `RegExp` objects based on unchanging configurations (like extensions) in file parsers instead of recreating them dynamically.
