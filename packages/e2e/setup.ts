/**
 * Shared e2e helpers: paths, CLI runner, fixture package wiring.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const e2eRoot = __dirname;
export const repoRoot = path.resolve(__dirname, "..", "..");
export const cliRoot = path.resolve(__dirname, "..", "cli");
export const coreRoot = path.resolve(__dirname, "..", "core");
export const adapterMdxRoot = path.resolve(__dirname, "..", "adapter-mdx");
export const binPath = path.join(cliRoot, "bin", "run.mjs");

export const fixture = (name: string) => path.join(__dirname, "fixtures", name);

/** Every fixture that has schema.ts / needs @contenz package links */
export const FIXTURES_WITH_SCHEMA = [
  "minimal",
  "i18n",
  "i18n-partial",
  "multi-type",
  "mixed-sources",
  "invalid-schema",
  "invalid-relation",
  "centralized",
  "large-project",
] as const;

export type CliResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

/**
 * Ensure a symlink from projectDir/node_modules/<pkg> → targetPath.
 * Leaves real directories alone (e.g. fixture-local installs).
 */
export function ensureSymlink(
  projectDir: string,
  pkg: string,
  target: string
): void {
  const linkPath = path.join(projectDir, "node_modules", ...pkg.split("/"));
  try {
    const stat = fs.lstatSync(linkPath);
    if (stat.isSymbolicLink()) {
      const resolved = path.resolve(
        path.dirname(linkPath),
        fs.readlinkSync(linkPath)
      );
      if (fs.existsSync(resolved)) return;
      fs.rmSync(linkPath, { recursive: true, force: true });
    } else {
      return;
    }
  } catch {
    /* doesn't exist yet */
  }
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  fs.symlinkSync(target, linkPath);
}

/**
 * Resolve the real zod package path under pnpm (not hoisted to repo root).
 */
export function resolveZodRoot(): string {
  const zodFromCore = path.join(coreRoot, "node_modules", "zod");
  if (fs.existsSync(zodFromCore)) return zodFromCore;
  const zodFromRoot = path.join(repoRoot, "node_modules", "zod");
  if (fs.existsSync(zodFromRoot)) return zodFromRoot;
  // pnpm store layout fallback
  try {
    return path.dirname(
      require.resolve("zod/package.json", { paths: [coreRoot, repoRoot] })
    );
  } catch {
    throw new Error(
      "Could not resolve zod for e2e fixtures (expected under @contenz/core)"
    );
  }
}

/**
 * Wire @contenz/core + adapter-mdx + zod into a fixture.
 * Schemas import `zod` and `@contenz/core`; under pnpm those are not
 * hoisted to the repo root, so fixtures need local links.
 */
export function linkFixturePackages(name: string): void {
  const dir = fixture(name);
  ensureSymlink(dir, "@contenz/core", coreRoot);
  ensureSymlink(dir, "@contenz/adapter-mdx", adapterMdxRoot);
  ensureSymlink(dir, "zod", resolveZodRoot());
}

/** Link packages for the given schema fixtures (default: full registry). */
export function linkAllFixtures(
  names: readonly string[] = FIXTURES_WITH_SCHEMA
): void {
  for (const name of names) {
    linkFixturePackages(name);
  }
}

export function runCli(
  args: string[],
  cwd: string,
  timeoutMs = 10_000
): CliResult {
  const result = spawnSync(process.execPath, [binPath, ...args], {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, FORCE_COLOR: "0" },
    timeout: timeoutMs,
  });
  if (result.signal === "SIGTERM") {
    return {
      status: 1,
      stdout: result.stdout ?? "",
      stderr: `[TIMEOUT after ${timeoutMs}ms] ${result.stderr ?? ""}`,
    };
  }
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

/** Remove generated/ and .contenz/ for a fixture (clean rebuild tests). */
export function cleanGenerated(fixturePath: string): void {
  const gen = path.join(fixturePath, "generated");
  if (fs.existsSync(gen)) fs.rmSync(gen, { recursive: true, force: true });
  const manifest = path.join(fixturePath, ".contenz");
  if (fs.existsSync(manifest)) {
    fs.rmSync(manifest, { recursive: true, force: true });
  }
}
