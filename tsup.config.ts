import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    api: "src/api.ts",
    cli: "src/cli.ts",
  },
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  sourcemap: true,
  dts: true,
  clean: true,
});
