import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(__dirname, "packages", "cli");
const binPath = path.join(cliRoot, "bin", "run.mjs");

function runCli(args, cwd) {
  const result = spawnSync(process.execPath, [binPath, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 10000,
    env: { ...process.env, CI: "1", FORCE_COLOR: "0" },
  });

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

const targetPath = path.resolve(__dirname, "packages/e2e/fixtures/minimal");

// The symlink the test usually makes
const pkgPath = path.join(targetPath, "node_modules", "@contenz", "core");
const actualCorePath = path.resolve(__dirname, "packages", "core");
try {
  fs.mkdirSync(path.dirname(pkgPath), { recursive: true });
  fs.symlinkSync(actualCorePath, pkgPath, "dir");
} catch(e) {}

// Same for CLI symlinks that might be missing?
const cliPkgPath = path.join(targetPath, "node_modules", "@contenz", "cli");
const actualCliPath = path.resolve(__dirname, "packages", "cli");
try {
  fs.mkdirSync(path.dirname(cliPkgPath), { recursive: true });
  fs.symlinkSync(actualCliPath, cliPkgPath, "dir");
} catch(e) {}

// same for citty
const cittyPkgPath = path.join(targetPath, "node_modules", "citty");
const actualCittyPath = path.resolve(__dirname, "node_modules", "citty");
try {
  fs.mkdirSync(path.dirname(cittyPkgPath), { recursive: true });
  fs.symlinkSync(actualCittyPath, cittyPkgPath, "dir");
} catch(e) {}

const res = runCli(["lint"], targetPath);
console.log("STATUS", res.status);
console.log("STDOUT", res.stdout);
console.log("STDERR", res.stderr);
