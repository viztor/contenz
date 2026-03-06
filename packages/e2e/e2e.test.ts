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
import { runBuild, runLint, runStatus } from "@contenz/core/api";

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

  it("build --dry-run exits 0 and does not write output files", () => {
    const generatedDir = path.join(cwd, "generated", "content");
    const faqPath = path.join(generatedDir, "faq.ts");
    if (fs.existsSync(faqPath)) fs.unlinkSync(faqPath);
    if (fs.existsSync(path.join(generatedDir, "index.ts"))) {
      fs.unlinkSync(path.join(generatedDir, "index.ts"));
    }
    const { status, stdout } = runCli(["build", "--dry-run"], cwd);
    expect(status).toBe(0);
    expect(stdout).toContain("Build diagnostics");
    expect(fs.existsSync(faqPath)).toBe(false);
  });

  it("build --force exits 0", () => {
    const { status } = runCli(["build", "--force"], cwd);
    expect(status).toBe(0);
    expect(fs.existsSync(path.join(cwd, "generated", "content", "faq.ts"))).toBe(true);
  });
});

describe("e2e: incremental build", () => {
  const minimalCwd = path.join(__dirname, "fixtures", "minimal");

  it("first build writes manifest, second build reuses cache", () => {
    const manifestPath = path.join(minimalCwd, ".contenz", "build-manifest.json");
    if (fs.existsSync(manifestPath)) fs.unlinkSync(manifestPath);
    runCli(["build"], minimalCwd);
    expect(fs.existsSync(manifestPath)).toBe(true);
    const firstFaq = fs.readFileSync(path.join(minimalCwd, "generated", "content", "faq.ts"), "utf-8");
    runCli(["build"], minimalCwd);
    const secondFaq = fs.readFileSync(path.join(minimalCwd, "generated", "content", "faq.ts"), "utf-8");
    expect(secondFaq).toBe(firstFaq);
  });

  it("build after content change regenerates only that collection", () => {
    const mixedCwd = path.join(__dirname, "fixtures", "mixed-sources");
    runCli(["build"], mixedCwd);
    const docsPath = path.join(mixedCwd, "generated", "content", "docs.ts");
    const faqPath = path.join(mixedCwd, "generated", "content", "faq.ts");
    const faqContentPath = path.join(mixedCwd, "content", "faq", "hello.mdx");
    const docsBefore = fs.readFileSync(docsPath, "utf-8");
    const faqBefore = fs.readFileSync(faqPath, "utf-8");
    const originalFaq = fs.readFileSync(faqContentPath, "utf-8");
    fs.writeFileSync(faqContentPath, originalFaq.replace("What is contenz?", "What is contenz? (e2e)"), "utf-8");
    runCli(["build"], mixedCwd);
    const docsAfter = fs.readFileSync(docsPath, "utf-8");
    const faqAfter = fs.readFileSync(faqPath, "utf-8");
    fs.writeFileSync(faqContentPath, originalFaq, "utf-8");
    expect(docsAfter).toBe(docsBefore);
    expect(faqAfter).not.toBe(faqBefore);
    expect(faqAfter).toContain("(e2e)");
  });
});

describe("e2e: build --dry-run --format json", () => {
  const minimalCwd = path.join(__dirname, "fixtures", "minimal");

  it("prints JSON with generated list and no files written", () => {
    const outPath = path.join(minimalCwd, "generated", "content", "faq.ts");
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    const { status, stdout } = runCli(["build", "--dry-run", "--format", "json"], minimalCwd);
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout) as { success: boolean; generated?: string[] };
    expect(parsed.success).toBe(true);
    expect(parsed.generated).toContain("faq.ts");
    expect(parsed.generated).toContain("index.ts");
    expect(fs.existsSync(outPath)).toBe(false);
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

  it("i18n: true remains backward-compatible (rich config not required)", () => {
    const { status } = runCli(["build"], cwd);
    expect(status).toBe(0);
    const out = fs.readFileSync(path.join(cwd, "generated", "content", "faq.ts"), "utf-8");
    expect(out).toContain("faqStats");
    expect(out).toContain("missingTranslations");
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

  it("lint --dry-run does not write coverage file", () => {
    const reportPath = path.join(minimalCwd, "contenz.coverage.md");
    if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
    runCli(["lint", "--coverage", "--dry-run"], minimalCwd);
    expect(fs.existsSync(reportPath)).toBe(false);
  });
});

describe("e2e: lint --collection", () => {
  const mixedCwd = path.join(__dirname, "fixtures", "mixed-sources");

  it("lint --collection faq lints only faq", () => {
    const { status, stdout } = runCli(["lint", "--collection", "faq"], mixedCwd);
    expect(status).toBe(0);
    expect(stdout).toContain("Lint diagnostics");
  });

  it("lint --collection docs lints only docs", () => {
    const { status } = runCli(["lint", "--collection", "docs"], mixedCwd);
    expect(status).toBe(0);
  });

  it("lint --collection nonexistent exits 1", () => {
    const { status, stdout } = runCli(["lint", "--collection", "nonexistent"], mixedCwd);
    expect(status).toBe(1);
    expect(stdout).toMatch(/not found|DISCOVERY_COLLECTION_NOT_FOUND/i);
  });
});

describe("e2e: status", () => {
  const minimalCwd = path.join(__dirname, "fixtures", "minimal");

  it("status exits 0 and reports up-to-date after build", () => {
    runCli(["build"], minimalCwd);
    const { status, stdout } = runCli(["status"], minimalCwd);
    expect(status).toBe(0);
    expect(stdout).toMatch(/up to date|Build is up to date/i);
  });

  it("status exits 1 when build needed", () => {
    runCli(["build"], minimalCwd);
    const faqPath = path.join(minimalCwd, "content", "faq", "hello.mdx");
    const content = fs.readFileSync(faqPath, "utf-8");
    fs.writeFileSync(faqPath, content + "\n", "utf-8");
    const { status } = runCli(["status"], minimalCwd);
    fs.writeFileSync(faqPath, content, "utf-8");
    expect(status).toBe(1);
  });

  it("status exits 1 when no build has been run", () => {
    const cwd = path.join(__dirname, "fixtures", "minimal");
    const generatedDir = path.join(cwd, "generated", "content");
    const manifestDir = path.join(cwd, ".contenz");
    const hadFaq = fs.existsSync(path.join(generatedDir, "faq.ts"));
    if (hadFaq) fs.unlinkSync(path.join(generatedDir, "faq.ts"));
    if (fs.existsSync(path.join(generatedDir, "index.ts"))) fs.unlinkSync(path.join(generatedDir, "index.ts"));
    if (fs.existsSync(path.join(manifestDir, "build-manifest.json"))) {
      fs.unlinkSync(path.join(manifestDir, "build-manifest.json"));
    }
    const { status, stdout } = runCli(["status"], cwd);
    if (hadFaq) runCli(["build"], cwd);
    expect(status).toBe(1);
    expect(stdout).toMatch(/need rebuild|Would rebuild|collection/i);
  });

  it("status --cwd from project root runs in fixture", () => {
    runCli(["build"], minimalCwd);
    const { status } = runCli(
      ["status", "--cwd", path.relative(path.join(__dirname, "..", "cli"), minimalCwd)],
      path.join(__dirname, "..", "cli")
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

describe("e2e: programmatic API (runBuild, runLint, runStatus)", () => {
  const minimalCwd = path.join(__dirname, "fixtures", "minimal");
  const invalidCwd = path.join(__dirname, "fixtures", "invalid-schema");

  it("runBuild with dryRun returns success and generated list without writing", async () => {
    const outPath = path.join(minimalCwd, "generated", "content", "faq.ts");
    const hadOutput = fs.existsSync(outPath);
    if (hadOutput) fs.unlinkSync(outPath);
    const result = await runBuild({ cwd: minimalCwd, dryRun: true });
    expect(result.success).toBe(true);
    expect(result.generated).toContain("faq.ts");
    expect(result.generated).toContain("index.ts");
    expect(fs.existsSync(outPath)).toBe(false);
    if (hadOutput) runCli(["build"], minimalCwd);
  });

  it("runBuild with force rebuilds all", async () => {
    await runBuild({ cwd: minimalCwd });
    const result = await runBuild({ cwd: minimalCwd, force: true });
    expect(result.success).toBe(true);
    expect(result.generated).toContain("faq.ts");
  });

  it("runLint with dryRun and coverage does not write coverage file", async () => {
    const coveragePath = path.join(minimalCwd, "contenz.coverage.md");
    if (fs.existsSync(coveragePath)) fs.unlinkSync(coveragePath);
    const result = await runLint({ cwd: minimalCwd, coverage: true, dryRun: true });
    expect(result.success).toBe(true);
    expect(fs.existsSync(coveragePath)).toBe(false);
  });

  it("runStatus returns up-to-date after build", async () => {
    await runBuild({ cwd: minimalCwd });
    const result = await runStatus({ cwd: minimalCwd });
    expect(result.status).toBe("up-to-date");
    expect(result.freshCollections).toContain("faq");
    expect(result.dirtyCollections).toEqual([]);
  });

  it("runStatus returns needs-build when content changed", async () => {
    await runBuild({ cwd: minimalCwd });
    const faqPath = path.join(minimalCwd, "content", "faq", "hello.mdx");
    const original = fs.readFileSync(faqPath, "utf-8");
    fs.writeFileSync(faqPath, original + "\n", "utf-8");
    const result = await runStatus({ cwd: minimalCwd });
    fs.writeFileSync(faqPath, original, "utf-8");
    expect(result.status).toBe("needs-build");
    expect(result.dirtyCollections).toContain("faq");
  });

  it("runBuild with format json returns parseable report", async () => {
    const result = await runBuild({ cwd: invalidCwd, format: "json" });
    const parsed = JSON.parse(result.report) as { title: string; success: boolean; diagnostics: unknown[] };
    expect(parsed.title).toBe("Build diagnostics");
    expect(parsed.success).toBe(false);
    expect(Array.isArray(parsed.diagnostics)).toBe(true);
  });
});
