/**
 * End-to-end tests for contenz.
 *
 * Split into two sections:
 *   1. CLI tests — spawn the CLI binary with strict timeouts
 *   2. Programmatic API tests — call the core API directly
 *
 * Fixtures live in fixtures/*. Each fixture with schema.ts needs
 * node_modules/@contenz/core symlinked to packages/core.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  runBuild,
  runLint,
  runStatus,
  runList,
  runView,
  runCreate,
  runUpdate,
  runSearch,
  runSchema,
} from "@contenz/core/api";

// ── Paths ───────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(__dirname, "..", "cli");
const coreRoot = path.resolve(__dirname, "..", "core");
const adapterMdxRoot = path.resolve(__dirname, "..", "adapter-mdx");
const binPath = path.join(cliRoot, "bin", "run.mjs");

const fixture = (name: string) => path.join(__dirname, "fixtures", name);

// ── Helpers ─────────────────────────────────────────────────────────────────

const CLI_TIMEOUT_MS = 10_000;

function runCli(
  args: string[],
  cwd: string
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [binPath, ...args], {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, FORCE_COLOR: "0" },
    timeout: CLI_TIMEOUT_MS,
  });
  if (result.signal === "SIGTERM") {
    return {
      status: 1,
      stdout: result.stdout ?? "",
      stderr: `[TIMEOUT after ${CLI_TIMEOUT_MS}ms] ${result.stderr ?? ""}`,
    };
  }
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

/** Ensure a symlink from projectDir/node_modules/<pkg> → targetPath */
function ensureSymlink(projectDir: string, pkg: string, target: string): void {
  const linkPath = path.join(projectDir, "node_modules", ...pkg.split("/"));
  try {
    const stat = fs.lstatSync(linkPath);
    if (stat.isSymbolicLink()) {
      const resolved = path.resolve(path.dirname(linkPath), fs.readlinkSync(linkPath));
      if (fs.existsSync(resolved)) return;
      fs.rmSync(linkPath, { recursive: true, force: true });
    } else {
      return; // real directory, leave it
    }
  } catch { /* doesn't exist yet */ }
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  fs.symlinkSync(target, linkPath);
}

const FIXTURES_WITH_SCHEMA = [
  "minimal",
  "i18n",
  "multi-type",
  "mixed-sources",
  "invalid-schema",
  "invalid-relation",
  "centralized",
];

beforeAll(() => {
  const zodRoot = path.join(coreRoot, "node_modules", "zod");
  for (const name of FIXTURES_WITH_SCHEMA) {
    ensureSymlink(fixture(name), "@contenz/core", coreRoot);
    ensureSymlink(fixture(name), "@contenz/adapter-mdx", adapterMdxRoot);
  }
  // Centralized fixture imports zod directly in contenz.config.ts
  ensureSymlink(fixture("centralized"), "zod", zodRoot);
});

// ═══════════════════════════════════════════════════════════════════════════
// CLI TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("cli: centralized (inline collections, no schema.ts)", () => {
  const cwd = fixture("centralized");

  it("lint exits 0 with inline schema", () => {
    const r = runCli(["lint"], cwd);
    expect(r.status).toBe(0);
  });

  it("build exits 0 and generates output", () => {
    const r = runCli(["build"], cwd);
    expect(r.status).toBe(0);
    expect(fs.existsSync(path.join(cwd, "generated", "content", "notes.ts"))).toBe(true);
  });

  it("build output contains content data", () => {
    runCli(["build", "--force"], cwd);
    const output = fs.readFileSync(
      path.join(cwd, "generated", "content", "notes.ts"),
      "utf-8"
    );
    expect(output).toContain("groceries");
    expect(output).toContain("reading");
    expect(output).toContain("Buy groceries");
  });
});

describe("cli: minimal (flat, no i18n)", () => {
  const cwd = fixture("minimal");

  it("lint exits 0", () => {
    const r = runCli(["lint"], cwd);
    expect(r.status).toBe(0);
  });

  it("build exits 0 and generates output", () => {
    const r = runCli(["build"], cwd);
    expect(r.status).toBe(0);
    expect(fs.existsSync(path.join(cwd, "generated", "content", "faq.ts"))).toBe(true);
    expect(fs.existsSync(path.join(cwd, "generated", "content", "index.ts"))).toBe(true);
  });

  it("lint --format json returns structured output", () => {
    const r = runCli(["lint", "--format", "json"], cwd);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
    expect(parsed.data.title).toBe("Lint diagnostics");
    expect(parsed.diagnostics).toEqual([]);
  });

  it("build --dry-run does not write files", () => {
    const faqPath = path.join(cwd, "generated", "content", "faq.ts");
    if (fs.existsSync(faqPath)) fs.unlinkSync(faqPath);
    const r = runCli(["build", "--dry-run"], cwd);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Build diagnostics");
    expect(fs.existsSync(faqPath)).toBe(false);
  });

  it("build --force exits 0", () => {
    const r = runCli(["build", "--force"], cwd);
    expect(r.status).toBe(0);
    expect(fs.existsSync(path.join(cwd, "generated", "content", "faq.ts"))).toBe(true);
  });
});

describe("cli: incremental build", () => {
  const cwd = fixture("minimal");
  const manifestPath = path.join(cwd, ".contenz", "build-manifest.json");

  it("first build writes manifest, second reuses cache", () => {
    if (fs.existsSync(manifestPath)) fs.unlinkSync(manifestPath);
    runCli(["build"], cwd);
    expect(fs.existsSync(manifestPath)).toBe(true);
    const first = fs.readFileSync(path.join(cwd, "generated", "content", "faq.ts"), "utf-8");
    runCli(["build"], cwd);
    const second = fs.readFileSync(path.join(cwd, "generated", "content", "faq.ts"), "utf-8");
    expect(second).toBe(first);
  });

  it("rebuild only changed collection", () => {
    const mixedCwd = fixture("mixed-sources");
    runCli(["build"], mixedCwd);
    const docsPath = path.join(mixedCwd, "generated", "content", "docs.ts");
    const faqPath = path.join(mixedCwd, "generated", "content", "faq.ts");
    const faqContentPath = path.join(mixedCwd, "content", "faq", "hello.json");
    const docsBefore = fs.readFileSync(docsPath, "utf-8");
    const faqBefore = fs.readFileSync(faqPath, "utf-8");
    const original = fs.readFileSync(faqContentPath, "utf-8");
    fs.writeFileSync(faqContentPath, original.replace("What is contenz?", "What is contenz? (e2e)"), "utf-8");
    runCli(["build"], mixedCwd);
    const docsAfter = fs.readFileSync(docsPath, "utf-8");
    const faqAfter = fs.readFileSync(faqPath, "utf-8");
    fs.writeFileSync(faqContentPath, original, "utf-8");
    expect(docsAfter).toBe(docsBefore);
    expect(faqAfter).not.toBe(faqBefore);
    expect(faqAfter).toContain("(e2e)");
  });
});

describe("cli: i18n", () => {
  const cwd = fixture("i18n");

  it("lint exits 0", () => {
    expect(runCli(["lint"], cwd).status).toBe(0);
  });

  it("build generates i18n collection", () => {
    const r = runCli(["build"], cwd);
    expect(r.status).toBe(0);
    const out = fs.readFileSync(path.join(cwd, "generated", "content", "faq.ts"), "utf-8");
    expect(out).toContain("locales");
    expect(out).toContain("en");
    expect(out).toContain("zh");
  });
});

describe("cli: multi-type", () => {
  const cwd = fixture("multi-type");

  it("lint exits 0", () => {
    expect(runCli(["lint"], cwd).status).toBe(0);
  });

  it("build generates typed exports", () => {
    const r = runCli(["build"], cwd);
    expect(r.status).toBe(0);
    const out = fs.readFileSync(path.join(cwd, "generated", "content", "terms.ts"), "utf-8");
    expect(out).toContain("terms");
    expect(out).toContain("topics");
  });
});

describe("cli: mixed-sources", () => {
  const cwd = fixture("mixed-sources");

  it("lint exits 0", () => {
    expect(runCli(["lint"], cwd).status).toBe(0);
  });

  it("build generates outputs for multiple sources", () => {
    const r = runCli(["build"], cwd);
    expect(r.status).toBe(0);
    expect(fs.readFileSync(path.join(cwd, "generated", "content", "docs.ts"), "utf-8")).toContain("Getting started");
    expect(fs.readFileSync(path.join(cwd, "generated", "content", "faq.ts"), "utf-8")).toContain("What is contenz?");
  });
});

describe("cli: invalid-schema", () => {
  const cwd = fixture("invalid-schema");

  it("lint exits 1", () => {
    const r = runCli(["lint"], cwd);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/Short|min|validation|error/i);
  });

  it("build --format github prints annotations", () => {
    const r = runCli(["build", "--format", "github"], cwd);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("::error ");
    expect(r.stdout).toContain("title=META_VALIDATION_FAILED");
  });
});

describe("cli: invalid-relation", () => {
  it("lint exits 1", () => {
    const r = runCli(["lint"], fixture("invalid-relation"));
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/nonexistent-slug|not found|relation/i);
  });
});

describe("cli: empty (no schema)", () => {
  const cwd = fixture("empty");

  it("lint exits 0", () => {
    const r = runCli(["lint"], cwd);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/No schema|configured source/i);
  });

  it("build exits 0", () => {
    expect(runCli(["build"], cwd).status).toBe(0);
  });
});

describe("cli: --coverage and --cwd", () => {
  const cwd = fixture("minimal");

  it("lint --coverage writes report", () => {
    const reportPath = path.join(cwd, "contenz.coverage.md");
    if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
    const r = runCli(["lint", "--coverage"], cwd);
    expect(r.status).toBe(0);
    expect(fs.existsSync(reportPath)).toBe(true);
    expect(fs.readFileSync(reportPath, "utf-8")).toContain("Coverage");
  });

  it("lint --cwd works from a different directory", () => {
    const r = runCli(["lint", "--cwd", path.relative(cliRoot, cwd)], cliRoot);
    expect(r.status).toBe(0);
  });

  it("lint --dry-run does not write coverage", () => {
    const reportPath = path.join(cwd, "contenz.coverage.md");
    if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
    runCli(["lint", "--coverage", "--dry-run"], cwd);
    expect(fs.existsSync(reportPath)).toBe(false);
  });
});

describe("cli: lint --collection", () => {
  const cwd = fixture("mixed-sources");

  it("lint --collection faq lints only faq", () => {
    const r = runCli(["lint", "--collection", "faq"], cwd);
    expect(r.status).toBe(0);
  });

  it("lint --collection nonexistent exits 1", () => {
    const r = runCli(["lint", "--collection", "nonexistent"], cwd);
    expect(r.status).toBe(1);
  });
});

describe("cli: status", () => {
  const cwd = fixture("minimal");

  it("status reports up-to-date after build", () => {
    runCli(["build"], cwd);
    const r = runCli(["status"], cwd);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/up to date|Build is up to date/i);
  });

  it("status exits 1 when content changed", () => {
    runCli(["build"], cwd);
    const faqPath = path.join(cwd, "content", "faq", "hello.json");
    const original = fs.readFileSync(faqPath, "utf-8");
    fs.writeFileSync(faqPath, original + "\n", "utf-8");
    const r = runCli(["status"], cwd);
    fs.writeFileSync(faqPath, original, "utf-8");
    expect(r.status).toBe(1);
  });
});

describe("cli: list", () => {
  const cwd = fixture("minimal");

  it("list returns collections", () => {
    const r = runCli(["list", "--format", "json"], cwd);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
    const faq = parsed.data.collections.find((c: { name: string }) => c.name === "faq");
    expect(faq).toBeDefined();
    expect(faq.items).toBeGreaterThan(0);
  });

  it("list <collection> returns items", () => {
    const r = runCli(["list", "faq", "--format", "json"], cwd);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.data.items[0].slug).toBe("hello");
  });

  it("list nonexistent exits 1", () => {
    const r = runCli(["list", "nonexistent", "--format", "json"], cwd);
    expect(r.status).toBe(1);
  });
});

describe("cli: view", () => {
  const cwd = fixture("minimal");

  it("view returns content item", () => {
    const r = runCli(["view", "faq", "hello", "--format", "json"], cwd);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.data.slug).toBe("hello");
    expect(parsed.data.meta.question).toBe("What is the minimum order quantity?");
  });

  it("view missing slug exits 1", () => {
    expect(runCli(["view", "faq", "nope", "--format", "json"], cwd).status).toBe(1);
  });
});

describe("cli: create", () => {
  const cwd = fixture("minimal");

  it("create with missing required field fails", () => {
    const r = runCli(["create", "faq", "e2e-invalid", "--set", "category=products", "--format", "json"], cwd);
    expect(r.status).toBe(1);
    const newFile = path.join(cwd, "content", "faq", "e2e-invalid.md");
    if (fs.existsSync(newFile)) fs.unlinkSync(newFile);
  });

  it("create in nonexistent collection exits 1", () => {
    expect(runCli(["create", "nonexistent", "test", "--set", "a=b", "--format", "json"], cwd).status).toBe(1);
  });
});

describe("cli: update", () => {
  const cwd = fixture("minimal");

  it("update modifies existing content", async () => {
    const faqPath = path.join(cwd, "content", "faq", "hello.json");
    const original = fs.readFileSync(faqPath, "utf-8");
    try {
      const r = runCli(["update", "faq", "hello", "--set", "question=Updated?", "--format", "json"], cwd);
      expect(r.status).toBe(0);
      const parsed = JSON.parse(r.stdout);
      expect(parsed.data.meta.question).toBe("Updated?");
      expect(parsed.data.meta.category).toBe("products");
    } finally {
      fs.writeFileSync(faqPath, original, "utf-8");
    }
  });

  it("update nonexistent exits 1", () => {
    expect(runCli(["update", "faq", "nope", "--set", "q=x", "--format", "json"], cwd).status).toBe(1);
  });

  it("update with no mutations exits 1", () => {
    const r = runCli(["update", "faq", "hello", "--format", "json"], cwd);
    expect(r.status).toBe(1);
  });
});

describe("cli: init", () => {
  it("scaffolds a starter project", () => {
    const cwd = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "contenz-init-"));
    try {
      const r = runCli(["init"], cwd);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain("Initialized contenz");
      expect(fs.existsSync(path.join(cwd, "contenz.config.ts"))).toBe(true);
      expect(fs.existsSync(path.join(cwd, "content", "pages", "schema.ts"))).toBe(true);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("refuses to overwrite without --force", () => {
    const cwd = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "contenz-init-"));
    try {
      fs.writeFileSync(path.join(cwd, "contenz.config.ts"), "export const config = {};", "utf-8");
      const r = runCli(["init"], cwd);
      expect(r.status).toBe(1);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PROGRAMMATIC API TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("api: runBuild", () => {
  const cwd = fixture("minimal");

  it("dryRun returns generated list without writing", async () => {
    const faqPath = path.join(cwd, "generated", "content", "faq.ts");
    const had = fs.existsSync(faqPath);
    if (had) fs.unlinkSync(faqPath);
    const result = await runBuild({ cwd, dryRun: true });
    expect(result.success).toBe(true);
    expect(result.generated).toContain("faq.ts");
    expect(result.generated).toContain("index.ts");
    expect(fs.existsSync(faqPath)).toBe(false);
    if (had) runCli(["build"], cwd); // restore
  });

  it("force rebuilds all", async () => {
    await runBuild({ cwd });
    const result = await runBuild({ cwd, force: true });
    expect(result.success).toBe(true);
    expect(result.generated).toContain("faq.ts");
  });

  it("format json returns parseable report", async () => {
    const result = await runBuild({ cwd: fixture("invalid-schema"), format: "json" });
    const parsed = JSON.parse(result.report);
    expect(parsed.success).toBe(false);
    expect(parsed.data.title).toBe("Build diagnostics");
  });
});

describe("api: runLint", () => {
  const cwd = fixture("minimal");

  it("dryRun with coverage does not write file", async () => {
    const reportPath = path.join(cwd, "contenz.coverage.md");
    if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
    const result = await runLint({ cwd, coverage: true, dryRun: true });
    expect(result.success).toBe(true);
    expect(fs.existsSync(reportPath)).toBe(false);
  });
});

describe("api: runStatus", () => {
  const cwd = fixture("minimal");

  it("up-to-date after build", async () => {
    await runBuild({ cwd });
    const result = await runStatus({ cwd });
    expect(result.status).toBe("up-to-date");
    expect(result.freshCollections).toContain("faq");
  });

  it("needs-build after content change", async () => {
    await runBuild({ cwd });
    const faqPath = path.join(cwd, "content", "faq", "hello.json");
    const original = fs.readFileSync(faqPath, "utf-8");
    fs.writeFileSync(faqPath, original + "\n", "utf-8");
    const result = await runStatus({ cwd });
    fs.writeFileSync(faqPath, original, "utf-8");
    expect(result.status).toBe("needs-build");
  });
});

describe("api: runList", () => {
  const cwd = fixture("minimal");

  it("lists all collections", async () => {
    const result = await runList({ cwd });
    expect(result.success).toBe(true);
    const data = result.data as { collections: Array<{ name: string; fields?: string[] }> };
    const faq = data.collections.find((c) => c.name === "faq");
    expect(faq).toBeDefined();
    expect(faq?.fields).toContain("question");
  });

  it("lists items in a collection", async () => {
    const result = await runList({ cwd, collection: "faq" });
    expect(result.success).toBe(true);
    const data = result.data as { items: Array<{ slug: string }> };
    expect(data.items[0].slug).toBe("hello");
  });

  it("returns error for nonexistent collection", async () => {
    const result = await runList({ cwd, collection: "nope" });
    expect(result.success).toBe(false);
  });
});

describe("api: runView", () => {
  const cwd = fixture("minimal");

  it("returns content item", async () => {
    const result = await runView({ cwd, collection: "faq", slug: "hello" });
    expect(result.success).toBe(true);
    expect(result.data?.meta.question).toBe("What is the minimum order quantity?");
  });

  it("returns error for missing slug", async () => {
    const result = await runView({ cwd, collection: "faq", slug: "nope" });
    expect(result.success).toBe(false);
  });
});

describe("api: runCreate", () => {
  const cwd = fixture("minimal");

  it("creates a new content item", async () => {
    // Default extension is "md" (first in extensions: ["md", "mdx"])
    const newFile = path.join(cwd, "content", "faq", "e2e-api.md");
    try {
      const result = await runCreate({
        cwd,
        collection: "faq",
        slug: "e2e-api",
        meta: { question: "What is a programmatic test?", category: "products" },
      });
      expect(result.success).toBe(true);
      expect(result.data?.slug).toBe("e2e-api");
      expect(fs.existsSync(newFile)).toBe(true);
    } finally {
      if (fs.existsSync(newFile)) fs.unlinkSync(newFile);
    }
  });

  it("rejects missing required fields", async () => {
    const result = await runCreate({
      cwd,
      collection: "faq",
      slug: "e2e-bad",
      meta: { category: "products" },
    });
    expect(result.success).toBe(false);
  });
});

describe("api: runUpdate", () => {
  const cwd = fixture("minimal");

  it("updates existing content preserving other fields", async () => {
    const faqPath = path.join(cwd, "content", "faq", "hello.json");
    const original = fs.readFileSync(faqPath, "utf-8");
    try {
      const result = await runUpdate({
        cwd,
        collection: "faq",
        slug: "hello",
        set: { question: "Updated programmatically?" },
      });
      expect(result.success).toBe(true);
      expect(result.data?.meta.question).toBe("Updated programmatically?");
      expect(result.data?.meta.category).toBe("products");
    } finally {
      fs.writeFileSync(faqPath, original, "utf-8");
    }
  });

  it("rejects update with no mutations", async () => {
    const result = await runUpdate({ cwd, collection: "faq", slug: "hello" });
    expect(result.success).toBe(false);
  });
});

describe("api: backward compatibility", () => {
  it("build still works after refactoring", () => {
    const r = runCli(["build", "--force"], fixture("minimal"));
    expect(r.status).toBe(0);
  });

  it("lint still works after refactoring", () => {
    expect(runCli(["lint"], fixture("minimal")).status).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("cli: search", () => {
  const cwd = fixture("minimal");

  it("search by slug returns matching items", () => {
    const r = runCli(["search", "faq", "hello", "--format", "json"], cwd);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
    expect(parsed.data.items.length).toBeGreaterThan(0);
    expect(parsed.data.items[0].slug).toBe("hello");
  });

  it("search with no matches returns empty", () => {
    const r = runCli(["search", "faq", "nonexistent-slug-xyz", "--format", "json"], cwd);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.data.items.length).toBe(0);
  });

  it("search nonexistent collection exits 1", () => {
    const r = runCli(["search", "nonexistent", "hello", "--format", "json"], cwd);
    expect(r.status).toBe(1);
  });

  it("search with field filter", () => {
    const r = runCli(["search", "faq", "--field", "category=products", "--format", "json"], cwd);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
    for (const item of parsed.data.items) {
      expect(item.meta.category).toBe("products");
    }
  });
});

describe("api: runSearch", () => {
  const cwd = fixture("minimal");

  it("finds items by slug substring", async () => {
    const result = await runSearch({ cwd, collection: "faq", query: "hello" });
    expect(result.success).toBe(true);
    expect(result.data?.items.length).toBeGreaterThan(0);
    expect(result.data?.items[0].slug).toBe("hello");
  });

  it("returns empty for no matches", async () => {
    const result = await runSearch({ cwd, collection: "faq", query: "nonexistent-xyz" });
    expect(result.success).toBe(true);
    expect(result.data?.items.length).toBe(0);
  });

  it("filters by field value", async () => {
    const result = await runSearch({ cwd, collection: "faq", fields: { category: "products" } });
    expect(result.success).toBe(true);
    for (const item of result.data?.items ?? []) {
      expect(item.meta.category).toBe("products");
    }
  });

  it("returns error for nonexistent collection", async () => {
    const result = await runSearch({ cwd, collection: "nope", query: "x" });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("cli: schema", () => {
  const cwd = fixture("minimal");

  it("schema returns field info", () => {
    const r = runCli(["schema", "faq", "--format", "json"], cwd);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
    expect(parsed.data.schema.fields.question).toBeDefined();
    expect(parsed.data.schema.fields.question.type).toBe("string");
    expect(parsed.data.schema.fields.category).toBeDefined();
  });

  it("schema nonexistent collection exits 1", () => {
    const r = runCli(["schema", "nonexistent", "--format", "json"], cwd);
    expect(r.status).toBe(1);
  });
});

describe("api: runSchema", () => {
  const cwd = fixture("minimal");

  it("returns introspected schema", async () => {
    const result = await runSchema({ cwd, collection: "faq" });
    expect(result.success).toBe(true);
    expect(result.data?.schema.fields.question).toBeDefined();
    expect(result.data?.schema.fields.question.type).toBe("string");
    expect(result.data?.schema.fields.question.required).toBe(true);
    expect(result.data?.schema.fields.category).toBeDefined();
  });

  it("returns error for nonexistent collection", async () => {
    const result = await runSchema({ cwd, collection: "nope" });
    expect(result.success).toBe(false);
  });
});
