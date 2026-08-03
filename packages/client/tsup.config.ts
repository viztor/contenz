import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  // tsup's rollup-plugin-dts does not support TypeScript 7; .d.ts via tsc
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
