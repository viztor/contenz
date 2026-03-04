/**
 * End-to-end tests: run the CLI against fixture projects and assert exit codes and output.
 * Fixtures are in tests/fixtures/*. Each fixture that has schema.ts files needs
 * node_modules/content-tools so that dynamic imports resolve; we create a symlink in beforeAll.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const binPath = path.join(projectRoot, "bin", "run.mjs");

const FIXTURES_WITH_SCHEMA = [
  "minimal",
  "i18n",
  "multi-type",
  "invalid-schema",
  "invalid-relation",
];

function runCli(
  args: string[],
  cwd: string
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [binPath, ...args], {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function ensureContentToolsSymlink(fixtureDir: string): void {
  const nodeModules = path.join(fixtureDir, "node_modules");
  const linkPath = path.join(nodeModules, "content-tools");
  if (fs.existsSync(linkPath)) return;
  fs.mkdirSync(nodeModules, { recursive: true });
  fs.symlinkSync(projectRoot, linkPath);
}

beforeAll(() => {
  for (const name of FIXTURES_WITH_SCHEMA) {
    ensureContentToolsSymlink(path.join(__dirname, "fixtures", name));
  }
});

describe("e2e: minimal (flat, no i18n)", () => {
  const cwd = path.join(__dirname, "fixtures", "minimal");

  it("lint exits 0", () => {
    const { status } = runCli(["lint"], cwd);
    expect(status).toBe(0);
  });

  it("build exits 0 and generates output", () => {
    const { status } = runCli(["build"], cwd);
    expect(status).toBe(0);
    const outFile = path.join(cwd, "generated", "content", "faq.ts");
    expect(fs.existsSync(outFile)).toBe(true);
    expect(fs.existsSync(path.join(cwd, "generated", "content", "index.ts"))).toBe(true);
  });
});

describe("e2e: i18n", () => {
  const cwd = path.join(__dirname, "fixtures", "i18n");

  it("lint exits 0", () => {
    const { status } = runCli(["lint"], cwd);
    expect(status).toBe(0);
  });

  it("build exits 0 and generates i18n collection", () => {
    const { status } = runCli(["build"], cwd);
    expect(status).toBe(0);
    const out = fs.readFileSync(path.join(cwd, "generated", "content", "faq.ts"), "utf-8");
    expect(out).toContain("locales");
    expect(out).toContain("moq");
    expect(out).toContain("en");
    expect(out).toContain("zh");
  });
});

describe("e2e: multi-type", () => {
  const cwd = path.join(__dirname, "fixtures", "multi-type");

  it("lint exits 0", () => {
    const { status } = runCli(["lint"], cwd);
    expect(status).toBe(0);
  });

  it("build exits 0 and generates terms with types", () => {
    const { status } = runCli(["build"], cwd);
    expect(status).toBe(0);
    const out = fs.readFileSync(path.join(cwd, "generated", "content", "terms.ts"), "utf-8");
    expect(out).toContain("terms");
    expect(out).toContain("topics");
    expect(out).toContain("moq");
    expect(out).toContain("topic-getting-started");
  });
});

describe("e2e: invalid-schema", () => {
  const cwd = path.join(__dirname, "fixtures", "invalid-schema");

  it("lint exits 1", () => {
    const { status, stdout } = runCli(["lint"], cwd);
    expect(status).toBe(1);
    expect(stdout).toMatch(/Short|min|validation|error/i);
  });
});

describe("e2e: invalid-relation", () => {
  const cwd = path.join(__dirname, "fixtures", "invalid-relation");

  it("lint exits 1", () => {
    const { status, stdout } = runCli(["lint"], cwd);
    expect(status).toBe(1);
    expect(stdout).toMatch(/nonexistent-slug|not found|relation/i);
  });
});

describe("e2e: empty (no schema)", () => {
  const cwd = path.join(__dirname, "fixtures", "empty");

  it("lint exits 0 and reports no schema", () => {
    const { status, stdout } = runCli(["lint"], cwd);
    expect(status).toBe(0);
    expect(stdout).toMatch(/No schema|found/i);
  });

  it("build exits 0 and does not create collection files", () => {
    const { status } = runCli(["build"], cwd);
    expect(status).toBe(0);
    const generatedDir = path.join(cwd, "generated", "content");
    if (fs.existsSync(generatedDir)) {
      const files = fs.readdirSync(generatedDir);
      expect(files).not.toContain("faq.ts");
    }
  });
});

describe("e2e: --coverage and --cwd", () => {
  const minimalCwd = path.join(__dirname, "fixtures", "minimal");

  it("lint --coverage writes coverage report file", () => {
    const reportPath = path.join(minimalCwd, "content.coverage.md");
    if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
    const { status } = runCli(["lint", "--coverage"], minimalCwd);
    expect(status).toBe(0);
    expect(fs.existsSync(reportPath)).toBe(true);
    expect(fs.readFileSync(reportPath, "utf-8")).toContain("Coverage");
  });

  it("lint --cwd from project root runs in fixture", () => {
    const { status } = runCli(
      ["lint", "--cwd", path.relative(projectRoot, minimalCwd)],
      projectRoot
    );
    expect(status).toBe(0);
  });
});
