#!/usr/bin/env node

/**
 * Publish all public @contenz packages to npm in dependency order.
 *
 * Usage:
 *   node scripts/publish.mjs              # publish all
 *   node scripts/publish.mjs --dry-run    # preview what would be published
 *   node scripts/publish.mjs --otp 123456 # pass OTP for 2FA
 */

import { execSync } from "node:child_process";
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
  if (!dryRun) {
    execSync(cmd, { cwd, stdio: "inherit" });
  }
}

function isVersionOnRegistry(name, version) {
  try {
    const out = execSync(`npm view ${name}@${version} version`, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return out === version;
  } catch {
    return false;
  }
}

console.log(
  `\n🚀 Publishing @contenz packages${dryRun ? " (dry run)" : ""}...\n`
);

// Build all packages first
console.log("━━━ Building ━━━");
run("pnpm run build", root);

// Publish in order
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

  // Prefer pnpm: uses GitHub OIDC trusted publishing when configured per package.
  // Falls back to NODE_AUTH_TOKEN from setup-node /.npmrc when present.
  // Args array (not a shell string) so the operator-supplied OTP is never
  // shell-interpolated.
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
    console.log(`  ✅ ${pkgJson.name}@${pkgJson.version} published`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Race: another run published between check and publish
    if (isVersionOnRegistry(pkgJson.name, pkgJson.version)) {
      console.log(
        `  ⏭  ${pkgJson.name}@${pkgJson.version} appeared on registry, continuing`
      );
      continue;
    }
    console.error(`  ❌ Failed to publish ${pkgJson.name}: ${msg}`);
    process.exit(1);
  }
}

console.log("\n✅ All packages published successfully!\n");
