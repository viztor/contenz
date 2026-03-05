import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    globals: false,
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html"],
      thresholds: {
        lines: 30,
        statements: 30,
        functions: 30,
        branches: 20,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
