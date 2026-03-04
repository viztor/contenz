#!/usr/bin/env node
/**
 * Runs the CLI with tsx so that the consumer's TypeScript config and schema files
 * (content.config.ts, content/.../schema.ts) can be loaded.
 *
 * Tsx is resolved from this package's node_modules so the CLI works when the
 * consumer does not depend on tsx (e.g. npx content-tools lint, pnpm exec content-tools build).
 */
import { spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
const cliPath = join(pkgRoot, "dist", "cli.js");

const require = createRequire(import.meta.url);
let tsxImport = "tsx";
try {
  tsxImport = require.resolve("tsx", { paths: [pkgRoot] });
} catch {
  // Fallback: use bare "tsx" so projects that list tsx as a dependency still work
}

const result = spawnSync(
  process.execPath,
  ["--import", tsxImport, cliPath, ...process.argv.slice(2)],
  { stdio: "inherit", cwd: process.cwd() }
);

process.exit(result.status ?? (result.signal ? 128 : 1));
