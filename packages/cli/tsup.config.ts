import { readFileSync } from "node:fs";

import { defineConfig } from "tsup";

const pkg = JSON.parse(
  readFileSync(new URL("package.json", import.meta.url), "utf-8")
) as { version: string };

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
  // Build-time version constant: dist chunks move, so resolving
  // package.json relative to the bundle is unreliable (see mcp.ts).
  define: {
    __CONTENZ_CLI_VERSION__: JSON.stringify(pkg.version),
  },
});
