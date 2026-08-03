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
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Packages in dependency order (core first, then dependents)
const PACKAGES = ["core", "client", "adapter-mdx", "cli"];

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const otpIdx = args.indexOf("--otp");
const otp = otpIdx !== -1 ? args[otpIdx + 1] : undefined;

function run(cmd, cwd) {
  console.log(`\n  $ ${cmd}`);
  if (!dryRun) {
    execSync(cmd, { cwd, stdio: "inherit" });
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
    (await import("node:fs")).readFileSync(
      path.join(pkgDir, "package.json"),
      "utf-8"
    )
  );

  if (pkgJson.private) {
    console.log(`\n⏭  Skipping ${pkgJson.name} (private)`);
    continue;
  }

  console.log(`\n━━━ Publishing ${pkgJson.name}@${pkgJson.version} ━━━`);

  // npm publish: reliable with setup-node registry-url + NODE_AUTH_TOKEN.
  // GitHub OIDC provenance is attached via --provenance when id-token: write.
  const publishCmd = [
    "npm publish --access public --provenance",
    otp ? `--otp ${otp}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    run(publishCmd, pkgDir);
    console.log(`  ✅ ${pkgJson.name}@${pkgJson.version} published`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Idempotent re-runs: version already on the registry
    if (
      msg.includes("cannot publish over") ||
      msg.includes("EPUBLISHCONFLICT") ||
      msg.includes("previously published versions")
    ) {
      console.log(
        `  ⏭  ${pkgJson.name}@${pkgJson.version} already published, continuing`
      );
      continue;
    }
    console.error(`  ❌ Failed to publish ${pkgJson.name}: ${msg}`);
    process.exit(1);
  }
}

console.log("\n✅ All packages published successfully!\n");
