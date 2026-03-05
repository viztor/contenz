#!/usr/bin/env node
/**
 * Wrapper that runs the CLI with tsx so that the consumer's TypeScript
 * config and schema files (contenz.config.ts, content/.../schema.ts) can be loaded.
 */
import { spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = join(__dirname, "..", "dist", "cli.js");

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", cliPath, ...process.argv.slice(2)],
  { stdio: "inherit", cwd: process.cwd() }
);

process.exit(result.status ?? (result.signal ? 128 : 1));
