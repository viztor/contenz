/**
 * End-to-end tests: run the CLI against fixture projects and assert exit codes and output.
 * Fixtures are in fixtures/*. Each fixture that has schema.ts files needs
 * node_modules/@contenz/core so that dynamic imports resolve; we create a symlink in beforeAll.
 * The CLI binary is run from packages/cli; schema symlink points to packages/core.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..", "..");
const cliRoot = path.resolve(__dirname, "..", "cli");
const coreRoot = path.resolve(__dirname, "..", "core");
const binPath = path.join(cliRoot, "bin", "run.mjs");
const zodRoot = path.join(workspaceRoot, "node_modules", "zod");

const FIXTURES_WITH_SCHEMA = [
  "minimal",
  "i18n",
  "multi-type",
  "mixed-sources",
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

function ensurePackageSymlink(projectDir: string, packageName: string, targetPath: string): void {
  const linkPath = path.join(projectDir, "node_modules", ...packageName.split("/"));
  try {
    const stat = fs.lstatSync(linkPath);
    if (stat.isSymbolicLink()) {
      const target = fs.readlinkSync(linkPath);
      const resolvedTarget = path.resolve(path.dirname(linkPath), target);
      if (fs.existsSync(resolvedTarget)) return;
      fs.rmSync(linkPath, { recursive: true, force: true });
    } else {
      return;
    }
  } catch {}
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  fs.symlinkSync(targetPath, linkPath);
}

function ensureContenzSymlink(fixtureDir: string): void {
  ensurePackageSymlink(fixtureDir, "@contenz/core", coreRoot);
}

function ensureInitProjectDependencies(projectDir: string): void {
  ensurePackageSymlink(projectDir, "@contenz/core", coreRoot);
  ensurePackageSymlink(projectDir, "zod", zodRoot);
}

beforeAll(() => {
  for (const name of FIXTURES_WITH_SCHEMA) {
    ensureContenzSymlink(path.join(__dirname, "fixtures", name));
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

  it("lint --format json exits 0 and prints structured diagnostics", () => {
    const { status, stdout } = runCli(["lint", "--format", "json"], cwd);
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout) as {
      title: string;
      success: boolean;
      summary: { errors: number; warnings: number; info: number };
      diagnostics: unknown[];
    };
    expect(parsed.title).toBe("Lint diagnostics");
    expect(parsed.success).toBe(true);
    expect(parsed.summary).toEqual({ errors: 0, warnings: 0, info: 0 });
    expect(parsed.diagnostics).toEqual([]);
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

describe("e2e: mixed-sources", () => {
  const cwd = path.join(__dirname, "fixtures", "mixed-sources");

  it("lint exits 0", () => {
    const { status } = runCli(["lint"], cwd);
    expect(status).toBe(0);
  });

  it("build exits 0 and generates outputs for self and child sources", () => {
    const { status } = runCli(["build"], cwd);
    expect(status).toBe(0);

    const docsOutput = fs.readFileSync(path.join(cwd, "generated", "content", "docs.ts"), "utf-8");
    const faqOutput = fs.readFileSync(path.join(cwd, "generated", "content", "faq.ts"), "utf-8");

    expect(docsOutput).toContain("Getting started");
    expect(faqOutput).toContain("What is contenz?");
  });
});

describe("e2e: invalid-schema", () => {
  const cwd = path.join(__dirname, "fixtures", "invalid-schema");

  it("lint exits 1", () => {
    const { status, stdout } = runCli(["lint"], cwd);
    expect(status).toBe(1);
    expect(stdout).toMatch(/Short|min|validation|error/i);
  });

  it("build --format github exits 1 and prints GitHub annotations", () => {
    const { status, stdout } = runCli(["build", "--format", "github"], cwd);
    expect(status).toBe(1);
    expect(stdout).toContain("::error ");
    expect(stdout).toContain("title=META_VALIDATION_FAILED");
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
    expect(stdout).toMatch(/No schema|configured source directories/i);
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
    const reportPath = path.join(minimalCwd, "contenz.coverage.md");
    if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
    const { status } = runCli(["lint", "--coverage"], minimalCwd);
    expect(status).toBe(0);
    expect(fs.existsSync(reportPath)).toBe(true);
    expect(fs.readFileSync(reportPath, "utf-8")).toContain("Coverage");
  });

  it("lint --cwd from project root runs in fixture", () => {
    const { status } = runCli(
      ["lint", "--cwd", path.relative(cliRoot, minimalCwd)],
      cliRoot
    );
    expect(status).toBe(0);
  });
});

describe("e2e: init", () => {
  it("scaffolds a starter project", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "contenz-init-"));

    try {
      const { status, stdout } = runCli(["init"], cwd);
      expect(status).toBe(0);
      expect(stdout).toContain("Initialized contenz");
      expect(fs.existsSync(path.join(cwd, "contenz.config.ts"))).toBe(true);
      expect(fs.existsSync(path.join(cwd, "content", "pages", "schema.ts"))).toBe(true);
      expect(fs.existsSync(path.join(cwd, "content", "pages", "welcome.mdx"))).toBe(true);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("does not overwrite existing files without --force", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "contenz-init-"));

    try {
      const configPath = path.join(cwd, "contenz.config.ts");
      fs.writeFileSync(configPath, "export const config = { strict: true };\n", "utf-8");

      const { status, stderr } = runCli(["init"], cwd);
      expect(status).toBe(1);
      expect(stderr).toContain("Cannot initialize contenz");
      expect(fs.readFileSync(configPath, "utf-8")).toContain("strict: true");
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("can lint and build the generated i18n starter", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "contenz-init-"));

    try {
      const initResult = runCli(["init", "--i18n"], cwd);
      expect(initResult.status).toBe(0);

      ensureInitProjectDependencies(cwd);

      const lintResult = runCli(["lint"], cwd);
      expect(lintResult.status).toBe(0);

      const buildResult = runCli(["build"], cwd);
      expect(buildResult.status).toBe(0);

      const outputPath = path.join(cwd, "generated", "content", "pages.ts");
      expect(fs.existsSync(outputPath)).toBe(true);

      const output = fs.readFileSync(outputPath, "utf-8");
      expect(output).toContain("welcome");
      expect(output).toContain("en");
      expect(output).toContain("zh");
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});
