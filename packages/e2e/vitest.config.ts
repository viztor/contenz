import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["e2e.test.ts", "e2e-advanced.test.ts"],
    globals: false,
    testTimeout: 20_000,
    hookTimeout: 10_000,
  },
});
