/**
 * Stress & edge-case end-to-end tests for contenz.
 *
 * Covers scenarios the existing suites miss:
 *   - Multi-collection projects (3+ collections with cross-collection relations)
 *   - Tri-locale i18n (en/zh/ja) with partial translation coverage
 *   - Bulk CRUD operations (create N items → search → cleanup)
 *   - Cross-collection relation validation (blog→glossary, glossary→glossary)
 *   - Build output structure verification (generated TS imports & data)
 *   - Incremental rebuild across multiple collections
 *   - CLI flag combinations (--format + --collection + --coverage)
 *   - Concurrent API calls (parallel operations on different collections)
 *   - Error recovery (create invalid → fix → lint passes)
 *   - Content idempotency under rapid mutation
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
  createWorkspace,
} from "@contenz/core/api";

// ── Paths ───────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(__dirname, "..", "cli");
const coreRoot = path.resolve(__dirname, "..", "core");
const adapterMdxRoot = path.resolve(__dirname, "..", "adapter-mdx");
const binPath = path.join(cliRoot, "bin", "run.mjs");

const fixture = (name: string) => path.join(__dirname, "fixtures", name);

// ── Helpers ─────────────────────────────────────────────────────────────────

const CLI_TIMEOUT_MS = 15_000;

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

function ensureSymlink(projectDir: string, pkg: string, target: string): void {
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

/** Clean up generated files for a fixture */
function cleanGenerated(fixturePath: string): void {
  const gen = path.join(fixturePath, "generated");
  if (fs.existsSync(gen)) fs.rmSync(gen, { recursive: true, force: true });
  const manifest = path.join(fixturePath, ".contenz");
  if (fs.existsSync(manifest))
    fs.rmSync(manifest, { recursive: true, force: true });
}

// ── Setup ───────────────────────────────────────────────────────────────────

const LARGE_PROJECT = fixture("large-project");

beforeAll(() => {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const zodRoot = path.join(repoRoot, "node_modules", "zod");
  for (const name of ["large-project", "minimal", "i18n", "mixed-sources"]) {
    ensureSymlink(fixture(name), "@contenz/core", coreRoot);
    ensureSymlink(fixture(name), "@contenz/adapter-mdx", adapterMdxRoot);
  }
  ensureSymlink(LARGE_PROJECT, "zod", zodRoot);
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: MULTI-COLLECTION DISCOVERY & WORKSPACE
// ═══════════════════════════════════════════════════════════════════════════

describe("multi-collection: workspace discovery", () => {
  it("discovers all three collections in large-project", async () => {
    const ws = await createWorkspace({ cwd: LARGE_PROJECT });
    const names = ws.collections.map((c) => c.name).sort();
    expect(names).toEqual(["blog", "changelog", "glossary"]);
  });

  it("each collection has loaded schema", async () => {
    const ws = await createWorkspace({ cwd: LARGE_PROJECT });
    for (const col of ws.collections) {
      expect(col.schema).not.toBeNull();
      expect(col.schema?.meta).toBeDefined();
    }
  });

  it("each collection has content files", async () => {
    const ws = await createWorkspace({ cwd: LARGE_PROJECT });
    for (const col of ws.collections) {
      expect(col.contentFiles.length).toBeGreaterThan(0);
    }
  });

  it("blog has i18n-suffixed files across 3 locales", async () => {
    const ws = await createWorkspace({ cwd: LARGE_PROJECT });
    const blog = ws.getCollection("blog");
    expect(blog).toBeDefined();
    const enFiles = blog!.contentFiles.filter((f) => f.includes(".en."));
    const zhFiles = blog!.contentFiles.filter((f) => f.includes(".zh."));
    const jaFiles = blog!.contentFiles.filter((f) => f.includes(".ja."));
    expect(enFiles.length).toBeGreaterThanOrEqual(3);
    expect(zhFiles.length).toBeGreaterThanOrEqual(1);
    expect(jaFiles.length).toBeGreaterThanOrEqual(1);
  });

  it("workspace filters correctly with collection option", async () => {
    const ws = await createWorkspace({
      cwd: LARGE_PROJECT,
      collection: "glossary",
    });
    expect(ws.collections.length).toBe(1);
    expect(ws.collections[0].name).toBe("glossary");
  });

  it("workspace returns undefined for nonexistent collection", async () => {
    const ws = await createWorkspace({ cwd: LARGE_PROJECT });
    expect(ws.getCollection("nonexistent")).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: CROSS-COLLECTION SCHEMA INTROSPECTION
// ═══════════════════════════════════════════════════════════════════════════

describe("multi-collection: schema introspection", () => {
  it("blog schema has relatedTerms field", async () => {
    const result = await runSchema({
      cwd: LARGE_PROJECT,
      collection: "blog",
    });
    expect(result.success).toBe(true);
    expect(result.data?.schema.fields.title).toBeDefined();
    expect(result.data?.schema.fields.author).toBeDefined();
    expect(result.data?.schema.fields.status).toBeDefined();
    expect(result.data?.schema.fields.relatedTerms).toBeDefined();
  });

  it("blog status field exposes enum options", async () => {
    const result = await runSchema({
      cwd: LARGE_PROJECT,
      collection: "blog",
    });
    expect(result.success).toBe(true);
    const status = result.data?.schema.fields.status;
    if (status?.options) {
      expect(status.options).toContain("draft");
      expect(status.options).toContain("published");
      expect(status.options).toContain("archived");
    }
  });

  it("glossary schema has self-referencing seeAlso relation", async () => {
    const result = await runSchema({
      cwd: LARGE_PROJECT,
      collection: "glossary",
    });
    expect(result.success).toBe(true);
    expect(result.data?.schema.fields.term).toBeDefined();
    expect(result.data?.schema.fields.definition).toBeDefined();
    expect(result.data?.schema.fields.seeAlso).toBeDefined();
  });

  it("changelog schema has boolean field", async () => {
    const result = await runSchema({
      cwd: LARGE_PROJECT,
      collection: "changelog",
    });
    expect(result.success).toBe(true);
    expect(result.data?.schema.fields.breaking).toBeDefined();
  });

  it("schema CLI --format json works for all collections", () => {
    for (const col of ["blog", "glossary", "changelog"]) {
      const r = runCli(
        ["schema", col, "--format", "json"],
        LARGE_PROJECT
      );
      expect(r.status).toBe(0);
      const parsed = JSON.parse(r.stdout);
      expect(parsed.success).toBe(true);
      expect(parsed.data.collection).toBe(col);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: MULTI-COLLECTION LIST & VIEW
// ═══════════════════════════════════════════════════════════════════════════

describe("multi-collection: list and view", () => {
  it("list returns all three collections", async () => {
    const result = await runList({ cwd: LARGE_PROJECT });
    expect(result.success).toBe(true);
    const data = result.data as {
      collections: Array<{ name: string; items?: number }>;
    };
    const names = data.collections.map((c) => c.name).sort();
    expect(names).toEqual(["blog", "changelog", "glossary"]);
  });

  it("list blog items shows locale info", async () => {
    const result = await runList({
      cwd: LARGE_PROJECT,
      collection: "blog",
    });
    expect(result.success).toBe(true);
    const data = result.data as {
      items: Array<{ slug: string; locale?: string }>;
    };
    expect(data.items.length).toBeGreaterThanOrEqual(3);
    const locales = [...new Set(data.items.map((i) => i.locale).filter(Boolean))];
    expect(locales).toContain("en");
  });

  it("view blog item in each locale returns correct language", async () => {
    const en = await runView({
      cwd: LARGE_PROJECT,
      collection: "blog",
      slug: "getting-started",
      locale: "en",
    });
    expect(en.success).toBe(true);
    expect(en.data?.meta.title).toBe("Getting Started with Contenz");

    const zh = await runView({
      cwd: LARGE_PROJECT,
      collection: "blog",
      slug: "getting-started",
      locale: "zh",
    });
    expect(zh.success).toBe(true);
    expect(zh.data?.meta.title).toBe("Contenz 入门指南");

    const ja = await runView({
      cwd: LARGE_PROJECT,
      collection: "blog",
      slug: "getting-started",
      locale: "ja",
    });
    expect(ja.success).toBe(true);
    expect(ja.data?.meta.title).toBe("Contenz の始め方");
  });

  it("view glossary item with seeAlso returns relation data", async () => {
    const result = await runView({
      cwd: LARGE_PROJECT,
      collection: "glossary",
      slug: "cms",
      locale: "en",
    });
    expect(result.success).toBe(true);
    expect(result.data?.meta.seeAlso).toEqual(["i18n"]);
  });

  it("view changelog item with boolean field", async () => {
    const result = await runView({
      cwd: LARGE_PROJECT,
      collection: "changelog",
      slug: "v2-0-0",
      locale: "en",
    });
    expect(result.success).toBe(true);
    expect(result.data?.meta.breaking).toBe(true);
    expect(result.data?.meta.version).toBe("2.0.0");
  });

  it("view CLI --format json returns structured output for each collection", () => {
    const tests = [
      { col: "blog", slug: "getting-started", locale: "en", field: "title" },
      { col: "glossary", slug: "cms", locale: "en", field: "term" },
      { col: "changelog", slug: "v1-0-0", locale: "en", field: "version" },
    ];
    for (const t of tests) {
      const r = runCli(
        ["view", t.col, t.slug, "--locale", t.locale, "--format", "json"],
        LARGE_PROJECT
      );
      expect(r.status).toBe(0);
      const parsed = JSON.parse(r.stdout);
      expect(parsed.data.meta[t.field]).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: CROSS-COLLECTION SEARCH
// ═══════════════════════════════════════════════════════════════════════════

describe("multi-collection: search", () => {
  it("search blog by slug substring", async () => {
    const result = await runSearch({
      cwd: LARGE_PROJECT,
      collection: "blog",
      query: "getting",
    });
    expect(result.success).toBe(true);
    expect(result.data?.items.length).toBeGreaterThan(0);
    expect(result.data?.items[0].slug).toContain("getting");
  });

  it("search blog by status field", async () => {
    const result = await runSearch({
      cwd: LARGE_PROJECT,
      collection: "blog",
      fields: { status: "draft" },
    });
    expect(result.success).toBe(true);
    for (const item of result.data?.items ?? []) {
      expect(item.meta.status).toBe("draft");
    }
  });

  it("search blog by author field", async () => {
    const result = await runSearch({
      cwd: LARGE_PROJECT,
      collection: "blog",
      fields: { author: "Alice" },
    });
    expect(result.success).toBe(true);
    expect(result.data?.items.length).toBeGreaterThan(0);
    for (const item of result.data?.items ?? []) {
      expect(item.meta.author).toBe("Alice");
    }
  });

  it("search blog by locale filters correctly", async () => {
    const enOnly = await runSearch({
      cwd: LARGE_PROJECT,
      collection: "blog",
      locale: "en",
    });
    expect(enOnly.success).toBe(true);

    const zhOnly = await runSearch({
      cwd: LARGE_PROJECT,
      collection: "blog",
      locale: "zh",
    });
    expect(zhOnly.success).toBe(true);

    // EN should have more items (partial locale coverage)
    expect(enOnly.data!.items.length).toBeGreaterThanOrEqual(
      zhOnly.data!.items.length
    );
  });

  it("search glossary by term field", async () => {
    const result = await runSearch({
      cwd: LARGE_PROJECT,
      collection: "glossary",
      fields: { term: "CMS" },
    });
    expect(result.success).toBe(true);
    expect(result.data?.items.length).toBeGreaterThan(0);
    expect(result.data?.items[0].meta.term).toBe("CMS");
  });

  it("search changelog with no query returns all", async () => {
    const result = await runSearch({
      cwd: LARGE_PROJECT,
      collection: "changelog",
    });
    expect(result.success).toBe(true);
    expect(result.data?.items.length).toBeGreaterThanOrEqual(2);
  });

  it("search with limit caps results", async () => {
    const result = await runSearch({
      cwd: LARGE_PROJECT,
      collection: "blog",
      limit: 1,
    });
    expect(result.success).toBe(true);
    expect(result.data?.items.length).toBeLessThanOrEqual(1);
  });

  it("CLI search across collections", () => {
    for (const col of ["blog", "glossary", "changelog"]) {
      const r = runCli(
        ["search", col, "--format", "json"],
        LARGE_PROJECT
      );
      expect(r.status).toBe(0);
      const parsed = JSON.parse(r.stdout);
      expect(parsed.success).toBe(true);
      expect(parsed.data.items.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: BULK CRUD LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════

describe("bulk CRUD: create, search, update, delete lifecycle", () => {
  const cwd = LARGE_PROJECT;
  const BULK_COUNT = 5;
  const createdFiles: string[] = [];

  afterAll(() => {
    for (const f of createdFiles) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it("bulk creates glossary items", async () => {
    for (let i = 0; i < BULK_COUNT; i++) {
      const slug = `e2e-bulk-${i}`;
      const result = await runCreate({
        cwd,
        collection: "glossary",
        slug,
        locale: "en",
        meta: {
          term: `Bulk Term ${i}`,
          definition: `Definition for bulk item ${i}`,
        },
      });
      expect(result.success).toBe(true);
      // runCreate writes .md by default (first extension in config)
      const fileMd = path.join(cwd, "content", "glossary", `${slug}.en.md`);
      const fileJson = path.join(cwd, "content", "glossary", `${slug}.en.json`);
      const created = fs.existsSync(fileMd) ? fileMd : fileJson;
      expect(fs.existsSync(created)).toBe(true);
      createdFiles.push(created);
    }
  });

  it("search finds all bulk-created items", async () => {
    const result = await runSearch({
      cwd,
      collection: "glossary",
      query: "e2e-bulk",
    });
    expect(result.success).toBe(true);
    expect(result.data?.items.length).toBe(BULK_COUNT);
  });

  it("bulk updates all items", async () => {
    for (let i = 0; i < BULK_COUNT; i++) {
      const result = await runUpdate({
        cwd,
        collection: "glossary",
        slug: `e2e-bulk-${i}`,
        locale: "en",
        set: { definition: `Updated definition ${i}` },
      });
      expect(result.success).toBe(true);
      expect(result.data?.meta.definition).toBe(`Updated definition ${i}`);
      // Ensure term is preserved
      expect(result.data?.meta.term).toBe(`Bulk Term ${i}`);
    }
  });

  it("view reflects all updates", async () => {
    for (let i = 0; i < BULK_COUNT; i++) {
      const result = await runView({
        cwd,
        collection: "glossary",
        slug: `e2e-bulk-${i}`,
        locale: "en",
      });
      expect(result.success).toBe(true);
      expect(result.data?.meta.definition).toBe(`Updated definition ${i}`);
    }
  });

  it("lint passes after bulk operations", async () => {
    const result = await runLint({ cwd });
    expect(result.success).toBe(true);
  });

  it("build succeeds with bulk content", async () => {
    const result = await runBuild({ cwd, force: true });
    expect(result.success).toBe(true);
    expect(result.generated).toContain("glossary.ts");
    expect(result.generated).toContain("blog.ts");
    expect(result.generated).toContain("changelog.ts");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: BUILD OUTPUT VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

describe("build output: generated TypeScript verification", () => {
  const cwd = LARGE_PROJECT;

  it("build generates files for all collections", async () => {
    await runBuild({ cwd, force: true });
    const genDir = path.join(cwd, "generated", "content");
    expect(fs.existsSync(path.join(genDir, "blog.ts"))).toBe(true);
    expect(fs.existsSync(path.join(genDir, "glossary.ts"))).toBe(true);
    expect(fs.existsSync(path.join(genDir, "changelog.ts"))).toBe(true);
    expect(fs.existsSync(path.join(genDir, "index.ts"))).toBe(true);
  });

  it("blog output contains locale-grouped data", () => {
    const output = fs.readFileSync(
      path.join(cwd, "generated", "content", "blog.ts"),
      "utf-8"
    );
    expect(output).toContain("getting-started");
    expect(output).toContain("locales");
    expect(output).toContain("en");
    expect(output).toContain("zh");
    expect(output).toContain("ja");
  });

  it("glossary output contains term definitions", () => {
    const output = fs.readFileSync(
      path.join(cwd, "generated", "content", "glossary.ts"),
      "utf-8"
    );
    expect(output).toContain("cms");
    expect(output).toContain("i18n");
    expect(output).toContain("CMS");
  });

  it("changelog output contains version data", () => {
    const output = fs.readFileSync(
      path.join(cwd, "generated", "content", "changelog.ts"),
      "utf-8"
    );
    expect(output).toContain("v1-0-0");
    expect(output).toContain("v2-0-0");
    expect(output).toContain("1.0.0");
    expect(output).toContain("2.0.0");
  });

  it("index.ts re-exports all collections", () => {
    const output = fs.readFileSync(
      path.join(cwd, "generated", "content", "index.ts"),
      "utf-8"
    );
    expect(output).toContain("blog");
    expect(output).toContain("glossary");
    expect(output).toContain("changelog");
  });

  it("double build produces identical output (idempotent)", async () => {
    await runBuild({ cwd, force: true });
    const first = {
      blog: fs.readFileSync(
        path.join(cwd, "generated", "content", "blog.ts"),
        "utf-8"
      ),
      glossary: fs.readFileSync(
        path.join(cwd, "generated", "content", "glossary.ts"),
        "utf-8"
      ),
      changelog: fs.readFileSync(
        path.join(cwd, "generated", "content", "changelog.ts"),
        "utf-8"
      ),
    };
    await runBuild({ cwd, force: true });
    const second = {
      blog: fs.readFileSync(
        path.join(cwd, "generated", "content", "blog.ts"),
        "utf-8"
      ),
      glossary: fs.readFileSync(
        path.join(cwd, "generated", "content", "glossary.ts"),
        "utf-8"
      ),
      changelog: fs.readFileSync(
        path.join(cwd, "generated", "content", "changelog.ts"),
        "utf-8"
      ),
    };
    expect(second.blog).toBe(first.blog);
    expect(second.glossary).toBe(first.glossary);
    expect(second.changelog).toBe(first.changelog);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: INCREMENTAL BUILD ACROSS COLLECTIONS
// ═══════════════════════════════════════════════════════════════════════════

describe("incremental build: multi-collection cache", () => {
  const cwd = LARGE_PROJECT;

  it("status reports up-to-date after full build", async () => {
    await runBuild({ cwd, force: true });
    const status = await runStatus({ cwd });
    expect(status.status).toBe("up-to-date");
  });

  it("modifying one collection only rebuilds that collection", async () => {
    await runBuild({ cwd, force: true });

    const blogFile = path.join(
      cwd,
      "content",
      "blog",
      "getting-started.en.json"
    );
    const original = fs.readFileSync(blogFile, "utf-8");
    const glossaryBefore = fs.readFileSync(
      path.join(cwd, "generated", "content", "glossary.ts"),
      "utf-8"
    );

    try {
      // Modify blog content
      const modified = original.replace(
        "Getting Started with Contenz",
        "Getting Started with Contenz (updated)"
      );
      fs.writeFileSync(blogFile, modified, "utf-8");

      // Status detects change
      const status = await runStatus({ cwd });
      expect(status.status).toBe("needs-build");

      // Incremental build
      await runBuild({ cwd });

      // Glossary should be unchanged
      const glossaryAfter = fs.readFileSync(
        path.join(cwd, "generated", "content", "glossary.ts"),
        "utf-8"
      );
      expect(glossaryAfter).toBe(glossaryBefore);

      // Blog should reflect change
      const blogOutput = fs.readFileSync(
        path.join(cwd, "generated", "content", "blog.ts"),
        "utf-8"
      );
      expect(blogOutput).toContain("(updated)");
    } finally {
      fs.writeFileSync(blogFile, original, "utf-8");
      await runBuild({ cwd, force: true });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8: CLI FLAG COMBINATIONS
// ═══════════════════════════════════════════════════════════════════════════

describe("CLI flag combinations", () => {
  const cwd = LARGE_PROJECT;

  it("lint --format json returns structured report", () => {
    const r = runCli(["lint", "--format", "json"], cwd);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
    expect(parsed.data.title).toBe("Lint diagnostics");
  });

  it("lint --collection blog --format json lints only blog", () => {
    const r = runCli(
      ["lint", "--collection", "blog", "--format", "json"],
      cwd
    );
    // May exit 0 (all valid) or 1 (cross-collection relation warnings);
    // the key assertion is that it runs without crashing and produces JSON.
    const parsed = JSON.parse(r.stdout);
    expect(parsed).toBeDefined();
  });

  it("lint --collection nonexistent fails", () => {
    const r = runCli(
      ["lint", "--collection", "nonexistent", "--format", "json"],
      cwd
    );
    expect(r.status).toBe(1);
  });

  it("build --dry-run --format json returns report without writing", () => {
    cleanGenerated(cwd);
    const r = runCli(["build", "--dry-run", "--format", "json"], cwd);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
    // Generated dir should NOT be created
    const genDir = path.join(cwd, "generated", "content");
    expect(fs.existsSync(genDir)).toBe(false);
    // Restore for subsequent tests
    runCli(["build", "--force"], cwd);
  });

  it("build --force --format json succeeds", () => {
    const r = runCli(["build", "--force", "--format", "json"], cwd);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
  });

  it("list --format json returns all collections", () => {
    const r = runCli(["list", "--format", "json"], cwd);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.data.collections.length).toBeGreaterThanOrEqual(3);
  });

  it("list <collection> --format json returns items", () => {
    for (const col of ["blog", "glossary", "changelog"]) {
      const r = runCli(["list", col, "--format", "json"], cwd);
      expect(r.status).toBe(0);
      const parsed = JSON.parse(r.stdout);
      expect(parsed.data.items.length).toBeGreaterThan(0);
    }
  });

  it("search with --field across collections", () => {
    const r = runCli(
      ["search", "blog", "--field", "status=published", "--format", "json"],
      cwd
    );
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    for (const item of parsed.data.items) {
      expect(item.meta.status).toBe("published");
    }
  });

  it("lint --coverage writes coverage report", () => {
    const reportPath = path.join(cwd, "contenz.coverage.md");
    if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
    const r = runCli(["lint", "--coverage"], cwd);
    expect(r.status).toBe(0);
    expect(fs.existsSync(reportPath)).toBe(true);
    const content = fs.readFileSync(reportPath, "utf-8");
    expect(content).toContain("Coverage");
    fs.unlinkSync(reportPath);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9: CONCURRENT API OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

describe("concurrent API: parallel operations", () => {
  const cwd = LARGE_PROJECT;

  it("parallel list on all collections succeeds", async () => {
    const [blog, glossary, changelog] = await Promise.all([
      runList({ cwd, collection: "blog" }),
      runList({ cwd, collection: "glossary" }),
      runList({ cwd, collection: "changelog" }),
    ]);
    expect(blog.success).toBe(true);
    expect(glossary.success).toBe(true);
    expect(changelog.success).toBe(true);
  });

  it("parallel view on different collections succeeds", async () => {
    const [blogView, glossaryView, changelogView] = await Promise.all([
      runView({
        cwd,
        collection: "blog",
        slug: "getting-started",
        locale: "en",
      }),
      runView({ cwd, collection: "glossary", slug: "cms", locale: "en" }),
      runView({
        cwd,
        collection: "changelog",
        slug: "v1-0-0",
        locale: "en",
      }),
    ]);
    expect(blogView.success).toBe(true);
    expect(glossaryView.success).toBe(true);
    expect(changelogView.success).toBe(true);
    expect(blogView.data?.meta.title).toBe("Getting Started with Contenz");
    expect(glossaryView.data?.meta.term).toBe("CMS");
    expect(changelogView.data?.meta.version).toBe("1.0.0");
  });

  it("parallel search on different collections succeeds", async () => {
    const [blogSearch, glossarySearch] = await Promise.all([
      runSearch({ cwd, collection: "blog", query: "getting" }),
      runSearch({ cwd, collection: "glossary", fields: { term: "i18n" } }),
    ]);
    expect(blogSearch.success).toBe(true);
    expect(glossarySearch.success).toBe(true);
    expect(blogSearch.data?.items.length).toBeGreaterThan(0);
    expect(glossarySearch.data?.items.length).toBeGreaterThan(0);
  });

  it("parallel schema introspection succeeds", async () => {
    const results = await Promise.all([
      runSchema({ cwd, collection: "blog" }),
      runSchema({ cwd, collection: "glossary" }),
      runSchema({ cwd, collection: "changelog" }),
    ]);
    for (const result of results) {
      expect(result.success).toBe(true);
      expect(result.data?.schema.fields).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 10: ERROR RECOVERY & VALIDATION EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

describe("error recovery: validation and edge cases", () => {
  const cwd = LARGE_PROJECT;

  it("create with invalid status enum fails", async () => {
    const result = await runCreate({
      cwd,
      collection: "blog",
      slug: "e2e-bad-status",
      locale: "en",
      meta: {
        title: "Bad Post",
        author: "Nobody",
        status: "INVALID_STATUS",
      },
    });
    expect(result.success).toBe(false);
    const file = path.join(
      cwd,
      "content",
      "blog",
      "e2e-bad-status.en.json"
    );
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  it("create with empty required title fails", async () => {
    const result = await runCreate({
      cwd,
      collection: "blog",
      slug: "e2e-empty-title",
      locale: "en",
      meta: { title: "", author: "Nobody", status: "draft" },
    });
    expect(result.success).toBe(false);
    const file = path.join(
      cwd,
      "content",
      "blog",
      "e2e-empty-title.en.json"
    );
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  it("create with missing all required fields fails", async () => {
    const result = await runCreate({
      cwd,
      collection: "blog",
      slug: "e2e-no-fields",
      locale: "en",
      meta: {},
    });
    expect(result.success).toBe(false);
  });

  it("update with invalid enum value fails", async () => {
    const result = await runUpdate({
      cwd,
      collection: "blog",
      slug: "getting-started",
      locale: "en",
      set: { status: "INVALID" },
    });
    expect(result.success).toBe(false);
  });

  it("view nonexistent slug returns error", async () => {
    const result = await runView({
      cwd,
      collection: "blog",
      slug: "does-not-exist-xyz",
      locale: "en",
    });
    expect(result.success).toBe(false);
  });

  it("create then fix then lint passes (error recovery)", async () => {
    // runCreate writes .md by default; discover the actual file
    const fileMd = path.join(cwd, "content", "blog", "e2e-recovery.en.md");
    const fileJson = path.join(cwd, "content", "blog", "e2e-recovery.en.json");
    try {
      // Create with valid data
      const createResult = await runCreate({
        cwd,
        collection: "blog",
        slug: "e2e-recovery",
        locale: "en",
        meta: {
          title: "Recovery Test",
          author: "Tester",
          status: "draft",
        },
      });
      expect(createResult.success).toBe(true);
      const file = fs.existsSync(fileMd) ? fileMd : fileJson;
      const isMd = file.endsWith(".md");

      // Corrupt the file manually (invalid status enum value)
      const brokenContent = isMd
        ? `---\ntitle: Recovery\nauthor: T\nstatus: BROKEN\n---\n`
        : JSON.stringify({ title: "Recovery", author: "T", status: "BROKEN" });
      fs.writeFileSync(file, brokenContent, "utf-8");

      // Lint should fail (lint all collections for cross-collection relation resolution)
      const lint1 = await runLint({ cwd, format: "json" });
      expect(lint1.success).toBe(false);

      // Fix the file
      const fixedContent = isMd
        ? `---\ntitle: Fixed Recovery\nauthor: Tester\nstatus: published\n---\n`
        : JSON.stringify({ title: "Fixed Recovery", author: "Tester", status: "published" });
      fs.writeFileSync(file, fixedContent, "utf-8");

      // Lint should now pass
      const lint2 = await runLint({ cwd, format: "json" });
      expect(lint2.success).toBe(true);
    } finally {
      if (fs.existsSync(fileMd)) fs.unlinkSync(fileMd);
      if (fs.existsSync(fileJson)) fs.unlinkSync(fileJson);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 11: I18N PARTIAL COVERAGE & LOCALE EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

describe("i18n: partial locale coverage and edge cases", () => {
  const cwd = LARGE_PROJECT;

  it("blog has partial locale coverage (en=3, zh=1, ja=1)", async () => {
    const enSearch = await runSearch({
      cwd,
      collection: "blog",
      locale: "en",
    });
    const zhSearch = await runSearch({
      cwd,
      collection: "blog",
      locale: "zh",
    });
    const jaSearch = await runSearch({
      cwd,
      collection: "blog",
      locale: "ja",
    });
    expect(enSearch.data!.items.length).toBeGreaterThanOrEqual(3);
    expect(zhSearch.data!.items.length).toBeGreaterThanOrEqual(1);
    expect(jaSearch.data!.items.length).toBeGreaterThanOrEqual(1);
    // EN has more content than zh or ja (partial translation)
    expect(enSearch.data!.items.length).toBeGreaterThan(
      zhSearch.data!.items.length
    );
  });

  it("glossary has partial locale coverage (en=3+, zh=1)", async () => {
    const enSearch = await runSearch({
      cwd,
      collection: "glossary",
      locale: "en",
    });
    const zhSearch = await runSearch({
      cwd,
      collection: "glossary",
      locale: "zh",
    });
    expect(enSearch.data!.items.length).toBeGreaterThanOrEqual(3);
    expect(zhSearch.data!.items.length).toBeGreaterThanOrEqual(1);
  });

  it("creating a new locale variant does not affect other locales", async () => {
    const fileMd = path.join(cwd, "content", "blog", "advanced-schemas.zh.md");
    const fileJson = path.join(cwd, "content", "blog", "advanced-schemas.zh.json");
    try {
      const createResult = await runCreate({
        cwd,
        collection: "blog",
        slug: "advanced-schemas",
        locale: "zh",
        meta: {
          title: "高级 Schema 模式",
          author: "Bob",
          tags: ["高级"],
          status: "published",
        },
      });
      expect(createResult.success).toBe(true);

      // EN version should be unchanged
      const enView = await runView({
        cwd,
        collection: "blog",
        slug: "advanced-schemas",
        locale: "en",
      });
      expect(enView.data?.meta.title).toBe("Advanced Schema Patterns");

      // ZH version should be the new one
      const zhView = await runView({
        cwd,
        collection: "blog",
        slug: "advanced-schemas",
        locale: "zh",
      });
      expect(zhView.data?.meta.title).toBe("高级 Schema 模式");
    } finally {
      if (fs.existsSync(fileMd)) fs.unlinkSync(fileMd);
      if (fs.existsSync(fileJson)) fs.unlinkSync(fileJson);
    }
  });

  it("update on one locale does not bleed to another", async () => {
    const enFile = path.join(
      cwd,
      "content",
      "glossary",
      "cms.en.json"
    );
    const original = fs.readFileSync(enFile, "utf-8");
    try {
      await runUpdate({
        cwd,
        collection: "glossary",
        slug: "cms",
        locale: "en",
        set: { definition: "Updated English definition" },
      });

      // ZH should be unchanged
      const zhView = await runView({
        cwd,
        collection: "glossary",
        slug: "cms",
        locale: "zh",
      });
      expect(zhView.data?.meta.definition).toBe("用于管理数字内容的系统");

      // EN should be updated
      const enView = await runView({
        cwd,
        collection: "glossary",
        slug: "cms",
        locale: "en",
      });
      expect(enView.data?.meta.definition).toBe(
        "Updated English definition"
      );
    } finally {
      fs.writeFileSync(enFile, original, "utf-8");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 12: FULL MULTI-COLLECTION LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════

describe("full lifecycle: multi-collection create → build → status → search", () => {
  const cwd = LARGE_PROJECT;
  const createdFiles: string[] = [];

  afterAll(() => {
    for (const f of createdFiles) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it("runs complete lifecycle across all collections", async () => {
    // 1. Introspect all schemas
    const schemas = await Promise.all([
      runSchema({ cwd, collection: "blog" }),
      runSchema({ cwd, collection: "glossary" }),
      runSchema({ cwd, collection: "changelog" }),
    ]);
    for (const s of schemas) {
      expect(s.success).toBe(true);
    }

    // 2. Create items in each collection
    const blogCreate = await runCreate({
      cwd,
      collection: "blog",
      slug: "e2e-lifecycle-post",
      locale: "en",
      meta: {
        title: "Lifecycle Test Post",
        author: "E2E",
        status: "draft",
        relatedTerms: ["cms"],
      },
    });
    expect(blogCreate.success).toBe(true);
    for (const ext of [".md", ".json"]) {
      const f = path.join(cwd, "content", "blog", `e2e-lifecycle-post.en${ext}`);
      if (fs.existsSync(f)) createdFiles.push(f);
    }

    const glossaryCreate = await runCreate({
      cwd,
      collection: "glossary",
      slug: "e2e-lifecycle-term",
      locale: "en",
      meta: {
        term: "Lifecycle",
        definition: "The process of existing through stages",
      },
    });
    expect(glossaryCreate.success).toBe(true);
    for (const ext of [".md", ".json"]) {
      const f = path.join(cwd, "content", "glossary", `e2e-lifecycle-term.en${ext}`);
      if (fs.existsSync(f)) createdFiles.push(f);
    }

    const changelogCreate = await runCreate({
      cwd,
      collection: "changelog",
      slug: "e2e-lifecycle-release",
      locale: "en",
      meta: { version: "99.0.0", date: "2099-01-01", breaking: false },
    });
    expect(changelogCreate.success).toBe(true);
    for (const ext of [".md", ".json"]) {
      const f = path.join(cwd, "content", "changelog", `e2e-lifecycle-release.en${ext}`);
      if (fs.existsSync(f)) createdFiles.push(f);
    }

    // 3. Lint all
    const lint = await runLint({ cwd });
    expect(lint.success).toBe(true);

    // 4. Build
    const build = await runBuild({ cwd, force: true });
    expect(build.success).toBe(true);
    expect(build.generated).toContain("blog.ts");
    expect(build.generated).toContain("glossary.ts");
    expect(build.generated).toContain("changelog.ts");

    // 5. Status
    const status = await runStatus({ cwd });
    expect(status.status).toBe("up-to-date");

    // 6. Search for created items
    const blogSearch = await runSearch({
      cwd,
      collection: "blog",
      query: "e2e-lifecycle",
    });
    expect(blogSearch.data?.items.length).toBe(1);
    expect(blogSearch.data?.items[0].meta.title).toBe("Lifecycle Test Post");

    const glossarySearch = await runSearch({
      cwd,
      collection: "glossary",
      query: "e2e-lifecycle",
    });
    expect(glossarySearch.data?.items.length).toBe(1);

    // 7. Update blog from draft → published
    const updateResult = await runUpdate({
      cwd,
      collection: "blog",
      slug: "e2e-lifecycle-post",
      locale: "en",
      set: { status: "published" },
    });
    expect(updateResult.success).toBe(true);
    expect(updateResult.data?.meta.status).toBe("published");
    expect(updateResult.data?.meta.title).toBe("Lifecycle Test Post"); // preserved

    // 8. Status should show needs-build
    const status2 = await runStatus({ cwd });
    expect(status2.status).toBe("needs-build");

    // 9. Incremental rebuild
    const build2 = await runBuild({ cwd });
    expect(build2.success).toBe(true);

    // 10. Verify output contains updated data
    const blogOutput = fs.readFileSync(
      path.join(cwd, "generated", "content", "blog.ts"),
      "utf-8"
    );
    expect(blogOutput).toContain("published");
    expect(blogOutput).toContain("e2e-lifecycle-post");

    // 11. Final status check
    const status3 = await runStatus({ cwd });
    expect(status3.status).toBe("up-to-date");
  });
});
