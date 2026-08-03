import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    api: "src/api.ts",
  },
  format: ["esm"],
  target: "node24",
  outDir: "dist",
  sourcemap: true,
  // tsup's rollup-plugin-dts does not support TypeScript 7; .d.ts via tsc
  dts: false,
  clean: true,
});
