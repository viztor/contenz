import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    "bash-complete": "src/bash-complete.ts",
  },
  format: ["esm"],
  target: "node24",
  outDir: "dist",
  sourcemap: true,
  clean: true,
});
