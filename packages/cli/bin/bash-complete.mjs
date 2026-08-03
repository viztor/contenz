#!/usr/bin/env node
/**
 * Thin wrapper for bash completion (no tsx needed — completion only uses built app).
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(__dirname, "..", "dist", "bash-complete.js");

const result = spawnSync(
  process.execPath,
  [scriptPath, ...process.argv.slice(2)],
  {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  }
);

process.exit(result.status ?? (result.signal ? 128 : 1));
