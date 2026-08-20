#!/usr/bin/env node

/**
 * Publish all public @contenz packages to npm in dependency order.
 *
 * Workspace `catalog:` / `workspace:` ranges are replaced by pnpm publish
 * with the catalog versions from pnpm-workspace.yaml.
 *
 * Usage:
 *   node scripts/publish.mjs              # publish all
 *   node scripts/publish.mjs --dry-run    # preview what would be published
 *   node scripts/publish.mjs --otp 123456 # pass OTP for 2FA
 */

import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Packages in dependency order (core first, then dependents)
const PACKAGES = ["core", "adapter-mdx", "cli"];

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const otpIdx = args.indexOf("--otp");
const otp = otpIdx !== -1 ? args[otpIdx + 1] : undefined;

function run(cmd, cwd) {
  const display = Array.isArray(cmd) ? cmd.join(" ") : cmd;
  console.log(`\n  $ ${display}`);
  if (dryRun) return;
  if (Array.isArray(cmd)) {
    const [file, ...argv] = cmd;
    execFileSync(file, argv, { cwd, stdio: "inherit" });
    return;
  }
  execSync(cmd, { cwd, stdio: "inherit" });
}

function isVersionOnRegistry(name, version) {
  const encoded = name.replace("/", "%2f");
  const url = `https://registry.npmjs.org/${encoded}/${version}`;
  try {
    execFileSync("curl", ["-fsS", "-H", "Cache-Control: no-cache", url], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

function sleep(seconds) {
  execSync(`sleep ${seconds}`);
}

/**
 * Trusted publishing can report success while npm still has the version
 * staged (not in the public packument). Wait until `npm view` sees it.
 */
function waitForRegistry(name, version, attempts = 36, delaySeconds = 5) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (isVersionOnRegistry(name, version)) return true;
    console.log(
      `  … waiting for ${name}@${version} on registry (${attempt}/${attempts})`
    );
    if (dryRun) return false;
    sleep(delaySeconds);
  }
  return isVersionOnRegistry(name, version);
}

console.log(
  `\n🚀 Publishing @contenz packages${dryRun ? " (dry run)" : ""}...\n`
);

console.log("━━━ Building ━━━");
run("pnpm run build", root);

for (const pkg of PACKAGES) {
  const pkgDir = path.join(root, "packages", pkg);
  const pkgJson = JSON.parse(
    fs.readFileSync(path.join(pkgDir, "package.json"), "utf-8")
  );

  if (pkgJson.private) {
    console.log(`\n⏭  Skipping ${pkgJson.name} (private)`);
    continue;
  }

  console.log(`\n━━━ Publishing ${pkgJson.name}@${pkgJson.version} ━━━`);

  if (isVersionOnRegistry(pkgJson.name, pkgJson.version)) {
    console.log(
      `  ⏭  ${pkgJson.name}@${pkgJson.version} already on registry, skipping`
    );
    continue;
  }

  const publishCmd = [
    "pnpm",
    "publish",
    "--access",
    "public",
    "--no-git-checks",
    ...(otp ? ["--otp", otp] : []),
  ];

  try {
    run(publishCmd, pkgDir);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const staged = /E409|previously staged version/.test(msg);
    if (!staged && !isVersionOnRegistry(pkgJson.name, pkgJson.version)) {
      console.error(`  ❌ Failed to publish ${pkgJson.name}: ${msg}`);
      process.exit(1);
    }
    if (staged) {
      console.log(
        `  ⚠  ${pkgJson.name}@${pkgJson.version} is staged on npm; waiting for it to go public`
      );
    }
  }

  if (dryRun) {
    console.log(`  ✅ ${pkgJson.name}@${pkgJson.version} would publish`);
    continue;
  }

  if (!waitForRegistry(pkgJson.name, pkgJson.version)) {
    console.error(
      `  ❌ ${pkgJson.name}@${pkgJson.version} did not appear on the public registry (staged/unpublished). Bump the version and retry.`
    );
    process.exit(1);
  }

  console.log(`  ✅ ${pkgJson.name}@${pkgJson.version} published`);
}

console.log("\n✅ All packages published successfully!\n");
