import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  // tsup's rollup-plugin-dts does not support TypeScript 7; .d.ts via tsc
  dts: false,
  clean: true,
  target: "node24",
});
