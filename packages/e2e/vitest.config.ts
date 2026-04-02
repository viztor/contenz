import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["e2e.test.ts", "e2e-advanced.test.ts", "e2e-stress.test.ts"],
    globals: false,
    testTimeout: 30_000,
    hookTimeout: 15_000,
    // Tests share mutable fixture dirs (manifests, generated output, temp files).
    // Parallel execution causes races where concurrent builds overwrite manifests.
    fileParallelism: false,
  },
});
