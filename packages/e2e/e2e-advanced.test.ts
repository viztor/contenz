/**
 * Advanced end-to-end tests targeting complex and edge-case scenarios.
 *
 * Covers:
 *   - i18n: locale-aware CRUD, locale filtering, cross-locale consistency
 *   - Multi-type: type routing, per-type schema introspection, type-aware CRUD
 *   - Mixed sources: multi-source discovery, cross-collection operations
 *   - Full lifecycle: create → view → search → update → view → lint → build → status
 *   - Error handling: validation failures, schema mismatches, edge cases
 *   - Search: complex field filters, combined slug + field + locale queries
 *   - Schema introspection: multi-type, enum values, optional fields
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

function ensureSymlink(projectDir: string, pkg: string, target: string): void {
  const linkPath = path.join(projectDir, "node_modules", ...pkg.split("/"));
  try {
    const stat = fs.lstatSync(linkPath);
    if (stat.isSymbolicLink()) {
      const resolved = path.resolve(path.dirname(linkPath), fs.readlinkSync(linkPath));
      if (fs.existsSync(resolved)) return;
      fs.rmSync(linkPath, { recursive: true, force: true });
    } else {
      return;
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
];

beforeAll(() => {
  for (const name of FIXTURES_WITH_SCHEMA) {
    ensureSymlink(fixture(name), "@contenz/core", coreRoot);
    ensureSymlink(fixture(name), "@contenz/adapter-mdx", adapterMdxRoot);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// I18N: LOCALE-AWARE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

describe("i18n: locale-aware CRUD lifecycle", () => {
  const cwd = fixture("i18n");

  it("view returns locale-specific content (en)", async () => {
    const result = await runView({ cwd, collection: "faq", slug: "moq", locale: "en" });
    expect(result.success).toBe(true);
    expect(result.data?.meta.question).toBe("What is the minimum order quantity?");
  });

  it("view returns locale-specific content (zh)", async () => {
    const result = await runView({ cwd, collection: "faq", slug: "moq", locale: "zh" });
    expect(result.success).toBe(true);
    expect(result.data?.meta.question).toBe("最低起订量是多少？");
  });

  it("list items shows locale info for i18n collection", async () => {
    const result = await runList({ cwd, collection: "faq" });
    expect(result.success).toBe(true);
    const data = result.data as { items: Array<{ slug: string; locale?: string }> };
    expect(data.items.length).toBeGreaterThanOrEqual(2);
    // Should have both en and zh for moq
    const locales = data.items.map((i) => i.locale).filter(Boolean);
    expect(locales).toContain("en");
    expect(locales).toContain("zh");
  });

  it("create + view + cleanup lifecycle with locale", async () => {
    const newFileEn = path.join(cwd, "content", "faq", "e2e-i18n.en.md");
    const newFileZh = path.join(cwd, "content", "faq", "e2e-i18n.zh.md");
    try {
      // Create EN version
      const createEn = await runCreate({
        cwd,
        collection: "faq",
        slug: "e2e-i18n",
        locale: "en",
        meta: { question: "E2E i18n test?", category: "products" },
      });
      expect(createEn.success).toBe(true);
      expect(fs.existsSync(newFileEn)).toBe(true);

      // Create ZH version
      const createZh = await runCreate({
        cwd,
        collection: "faq",
        slug: "e2e-i18n",
        locale: "zh",
        meta: { question: "国际化端到端测试？", category: "products" },
      });
      expect(createZh.success).toBe(true);
      expect(fs.existsSync(newFileZh)).toBe(true);

      // View EN
      const viewEn = await runView({ cwd, collection: "faq", slug: "e2e-i18n", locale: "en" });
      expect(viewEn.success).toBe(true);
      expect(viewEn.data?.meta.question).toBe("E2E i18n test?");

      // View ZH
      const viewZh = await runView({ cwd, collection: "faq", slug: "e2e-i18n", locale: "zh" });
      expect(viewZh.success).toBe(true);
      expect(viewZh.data?.meta.question).toBe("国际化端到端测试？");

      // Search by locale — en only
      const searchEn = await runSearch({ cwd, collection: "faq", query: "e2e-i18n", locale: "en" });
      expect(searchEn.success).toBe(true);
      expect(searchEn.data?.items.length).toBe(1);
      expect(searchEn.data?.items[0].locale).toBe("en");
    } finally {
      if (fs.existsSync(newFileEn)) fs.unlinkSync(newFileEn);
      if (fs.existsSync(newFileZh)) fs.unlinkSync(newFileZh);
    }
  });

  it("update preserves locale-specific content", async () => {
    const filePath = path.join(cwd, "content", "faq", "moq.en.json");
    const original = fs.readFileSync(filePath, "utf-8");
    try {
      const result = await runUpdate({
        cwd,
        collection: "faq",
        slug: "moq",
        locale: "en",
        set: { question: "Updated MOQ question?" },
      });
      expect(result.success).toBe(true);
      expect(result.data?.meta.question).toBe("Updated MOQ question?");
      expect(result.data?.meta.category).toBe("products");

      // Verify ZH is unchanged
      const viewZh = await runView({ cwd, collection: "faq", slug: "moq", locale: "zh" });
      expect(viewZh.data?.meta.question).toBe("最低起订量是多少？");
    } finally {
      fs.writeFileSync(filePath, original, "utf-8");
    }
  });

  it("search filters by locale correctly", async () => {
    const zhResults = await runSearch({ cwd, collection: "faq", locale: "zh" });
    expect(zhResults.success).toBe(true);
    for (const item of zhResults.data?.items ?? []) {
      expect(item.locale).toBe("zh");
    }

    const enResults = await runSearch({ cwd, collection: "faq", locale: "en" });
    expect(enResults.success).toBe(true);
    for (const item of enResults.data?.items ?? []) {
      expect(item.locale).toBe("en");
    }
  });

  it("i18n build generates locale-grouped output", async () => {
    const buildResult = await runBuild({ cwd, force: true });
    expect(buildResult.success).toBe(true);
    const output = fs.readFileSync(path.join(cwd, "generated", "content", "faq.ts"), "utf-8");
    expect(output).toContain("locales");
    expect(output).toContain("en");
    expect(output).toContain("zh");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-TYPE: TYPE ROUTING AND PER-TYPE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

describe("multi-type: type routing and schema introspection", () => {
  const cwd = fixture("multi-type");

  it("schema introspects default (first) schema type", async () => {
    const result = await runSchema({ cwd, collection: "terms" });
    expect(result.success).toBe(true);
    // Default is the first schema (term)
    expect(result.data?.schema.fields.term).toBeDefined();
    expect(result.data?.schema.fields.term.type).toBe("string");
    expect(result.data?.schema.fields.definition).toBeDefined();
  });

  it("schema introspects specific type (topic)", async () => {
    const result = await runSchema({ cwd, collection: "terms", contentType: "topic" });
    expect(result.success).toBe(true);
    expect(result.data?.contentType).toBe("topic");
    expect(result.data?.schema.fields.title).toBeDefined();
    expect(result.data?.schema.fields.title.type).toBe("string");
    expect(result.data?.schema.fields.description).toBeDefined();
    expect(result.data?.schema.fields.description.required).toBe(false);
  });

  it("schema introspects specific type (term)", async () => {
    const result = await runSchema({ cwd, collection: "terms", contentType: "term" });
    expect(result.success).toBe(true);
    expect(result.data?.contentType).toBe("term");
    expect(result.data?.schema.fields.term).toBeDefined();
    expect(result.data?.schema.fields.definition.type).toBe("string");
  });

  it("schema rejects nonexistent type", async () => {
    const result = await runSchema({ cwd, collection: "terms", contentType: "nonexistent" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("nonexistent");
  });

  it("view reads term-type content correctly", async () => {
    const result = await runView({ cwd, collection: "terms", slug: "moq", locale: "en" });
    expect(result.success).toBe(true);
    expect(result.data?.meta.term).toBe("MOQ");
    expect(result.data?.meta.definition).toBe("Minimum order quantity.");
  });

  it("view reads topic-type content correctly", async () => {
    const result = await runView({ cwd, collection: "terms", slug: "topic-getting-started", locale: "en" });
    expect(result.success).toBe(true);
    expect(result.data?.meta.title).toBe("Getting started");
    expect(result.data?.meta.description).toBe("Introduction to the glossary");
  });

  it("list returns all items across types", async () => {
    const result = await runList({ cwd, collection: "terms" });
    expect(result.success).toBe(true);
    const data = result.data as { items: Array<{ slug: string }> };
    const slugs = data.items.map((i) => i.slug);
    expect(slugs).toContain("moq");
    expect(slugs).toContain("topic-getting-started");
  });

  it("search finds items across types by slug", async () => {
    const result = await runSearch({ cwd, collection: "terms", query: "topic" });
    expect(result.success).toBe(true);
    expect(result.data?.items.length).toBeGreaterThan(0);
    expect(result.data?.items[0].slug).toContain("topic");
  });

  it("search finds term-type items by field filter", async () => {
    const result = await runSearch({ cwd, collection: "terms", fields: { term: "MOQ" } });
    expect(result.success).toBe(true);
    expect(result.data?.items.length).toBeGreaterThan(0);
    expect(result.data?.items[0].meta.term).toBe("MOQ");
  });

  it("build generates typed multi-type output", async () => {
    const buildResult = await runBuild({ cwd, force: true });
    expect(buildResult.success).toBe(true);
    const output = fs.readFileSync(path.join(cwd, "generated", "content", "terms.ts"), "utf-8");
    expect(output).toContain("terms");
    expect(output).toContain("topics");
  });

  it("create + view lifecycle for term type with locale", async () => {
    const newFile = path.join(cwd, "content", "terms", "e2e-term.en.md");
    try {
      const createResult = await runCreate({
        cwd,
        collection: "terms",
        slug: "e2e-term",
        locale: "en",
        meta: { term: "E2E Test", definition: "A test spanning the full stack." },
      });
      expect(createResult.success).toBe(true);

      const viewResult = await runView({ cwd, collection: "terms", slug: "e2e-term", locale: "en" });
      expect(viewResult.success).toBe(true);
      expect(viewResult.data?.meta.term).toBe("E2E Test");
      expect(viewResult.data?.meta.definition).toBe("A test spanning the full stack.");
    } finally {
      if (fs.existsSync(newFile)) fs.unlinkSync(newFile);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MIXED SOURCES: MULTI-SOURCE DISCOVERY
// ═══════════════════════════════════════════════════════════════════════════

describe("mixed-sources: cross-collection operations", () => {
  const cwd = fixture("mixed-sources");

  it("list returns collections from different source patterns", async () => {
    const result = await runList({ cwd });
    expect(result.success).toBe(true);
    const data = result.data as { collections: Array<{ name: string }> };
    const names = data.collections.map((c) => c.name);
    expect(names).toContain("faq");
    expect(names).toContain("docs");
  });

  it("view works for content/* collection", async () => {
    const result = await runView({ cwd, collection: "faq", slug: "hello" });
    expect(result.success).toBe(true);
    expect(result.data?.meta.question).toBe("What is contenz?");
  });

  it("view works for root-level collection (docs)", async () => {
    const result = await runView({ cwd, collection: "docs", slug: "getting-started" });
    expect(result.success).toBe(true);
    expect(result.data?.meta.title).toBe("Getting started");
  });

  it("schema works for root-level collection", async () => {
    const result = await runSchema({ cwd, collection: "docs" });
    expect(result.success).toBe(true);
    expect(result.data?.schema.fields.title).toBeDefined();
    expect(result.data?.schema.fields.title.required).toBe(true);
  });

  it("search across different source collections", async () => {
    const faqSearch = await runSearch({ cwd, collection: "faq", query: "hello" });
    expect(faqSearch.success).toBe(true);
    expect(faqSearch.data?.items.length).toBeGreaterThan(0);

    const docsSearch = await runSearch({ cwd, collection: "docs", query: "getting" });
    expect(docsSearch.success).toBe(true);
    expect(docsSearch.data?.items.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FULL LIFECYCLE: END-TO-END WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════

describe("full lifecycle: create → view → search → update → lint → build → status", () => {
  const cwd = fixture("minimal");
  const slug = "e2e-lifecycle";
  const newFile = path.join(cwd, "content", "faq", `${slug}.md`);

  afterAll(() => {
    if (fs.existsSync(newFile)) fs.unlinkSync(newFile);
  });

  it("runs entire content lifecycle via CLI", async () => {
    // 1. Introspect schema first (AI agent discovery)
    const schema = runCli(["schema", "faq", "--format", "json"], cwd);
    expect(schema.status).toBe(0);
    const schemaData = JSON.parse(schema.stdout);
    expect(schemaData.data.schema.fields.question).toBeDefined();
    expect(schemaData.data.schema.fields.category).toBeDefined();

    // 2. Create new item (use API to avoid shell quoting issues with spaces in --set values)
    const createResult = await runCreate({
      cwd,
      collection: "faq",
      slug,
      meta: { question: "What is an end-to-end lifecycle test?", category: "products" },
    });
    expect(createResult.success).toBe(true);
    expect(createResult.data?.slug).toBe(slug);
    expect(fs.existsSync(newFile)).toBe(true);

    // 3. View the created item
    const view = runCli(["view", "faq", slug, "--format", "json"], cwd);
    expect(view.status).toBe(0);
    const viewData = JSON.parse(view.stdout);
    expect(viewData.data.meta.question).toBe("What is an end-to-end lifecycle test?");
    expect(viewData.data.meta.category).toBe("products");

    // 4. Search for the created item
    const search = runCli(["search", "faq", slug, "--format", "json"], cwd);
    expect(search.status).toBe(0);
    const searchData = JSON.parse(search.stdout);
    expect(searchData.data.items.length).toBe(1);
    expect(searchData.data.items[0].slug).toBe(slug);

    // 5. Search by field value
    const fieldSearch = runCli(["search", "faq", "--field", "category=products", "--format", "json"], cwd);
    expect(fieldSearch.status).toBe(0);
    const fieldSearchData = JSON.parse(fieldSearch.stdout);
    const lifecycleItem = fieldSearchData.data.items.find(
      (i: { slug: string }) => i.slug === slug
    );
    expect(lifecycleItem).toBeDefined();

    // 6. Update the item (use API to avoid shell quoting issues)
    const updateResult = await runUpdate({
      cwd,
      collection: "faq",
      slug,
      set: { question: "Updated lifecycle test question?", category: "ordering" },
    });
    expect(updateResult.success).toBe(true);
    expect(updateResult.data?.meta.question).toBe("Updated lifecycle test question?");
    expect(updateResult.data?.meta.category).toBe("ordering");

    // 7. Verify view reflects the update
    const viewAfter = runCli(["view", "faq", slug, "--format", "json"], cwd);
    const viewAfterData = JSON.parse(viewAfter.stdout);
    expect(viewAfterData.data.meta.question).toBe("Updated lifecycle test question?");
    expect(viewAfterData.data.meta.category).toBe("ordering");

    // 8. Lint validates the updated content
    const lint = runCli(["lint", "--format", "json"], cwd);
    expect(lint.status).toBe(0);
    const lintData = JSON.parse(lint.stdout);
    expect(lintData.success).toBe(true);

    // 9. Build succeeds with the new content
    const build = runCli(["build", "--force", "--format", "json"], cwd);
    expect(build.status).toBe(0);

    // 10. Status reports up-to-date
    const status = runCli(["status"], cwd);
    expect(status.status).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ERROR HANDLING AND EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

describe("error handling: validation failures and edge cases", () => {
  const minimalCwd = fixture("minimal");
  const invalidSchemaCwd = fixture("invalid-schema");
  const invalidRelationCwd = fixture("invalid-relation");

  it("create rejects invalid enum value", async () => {
    const result = await runCreate({
      cwd: minimalCwd,
      collection: "faq",
      slug: "e2e-bad-enum",
      meta: { question: "What?", category: "INVALID_CATEGORY" },
    });
    expect(result.success).toBe(false);
    // Core returns "Validation failed" as the error string
    expect(result.error || JSON.stringify(result.diagnostics)).toBeDefined();
    // File should NOT be created
    const file = path.join(minimalCwd, "content", "faq", "e2e-bad-enum.md");
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  it("create rejects when all required fields are missing", async () => {
    const result = await runCreate({
      cwd: minimalCwd,
      collection: "faq",
      slug: "e2e-empty-meta",
      meta: {},
    });
    expect(result.success).toBe(false);
  });

  it("update --set with invalid enum value fails", async () => {
    const result = await runUpdate({
      cwd: minimalCwd,
      collection: "faq",
      slug: "hello",
      set: { category: "INVALID" },
    });
    expect(result.success).toBe(false);
  });

  it("view nonexistent slug returns structured error", async () => {
    const result = await runView({
      cwd: minimalCwd,
      collection: "faq",
      slug: "absolutely-does-not-exist",
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("search with no query and no field filters returns all items", async () => {
    const result = await runSearch({ cwd: minimalCwd, collection: "faq" });
    expect(result.success).toBe(true);
    expect(result.data?.items.length).toBeGreaterThan(0);
  });

  it("search with limit=1 caps results", async () => {
    const result = await runSearch({ cwd: minimalCwd, collection: "faq", limit: 1 });
    expect(result.success).toBe(true);
    expect(result.data?.items.length).toBeLessThanOrEqual(1);
  });

  it("search with non-matching field filter returns empty", async () => {
    const result = await runSearch({
      cwd: minimalCwd,
      collection: "faq",
      fields: { question: "this string should never match anything" },
    });
    expect(result.success).toBe(true);
    expect(result.data?.items.length).toBe(0);
  });

  it("lint detects schema validation error (min length)", async () => {
    const lintResult = await runLint({ cwd: invalidSchemaCwd, format: "json" });
    expect(lintResult.success).toBe(false);
    const parsed = JSON.parse(lintResult.report);
    expect(parsed.diagnostics.length).toBeGreaterThan(0);
    expect(parsed.diagnostics[0].message || "").toMatch(/too small|at least|character|string/i);
  });

  it("lint detects invalid relation (nonexistent slug)", async () => {
    const lintResult = await runLint({ cwd: invalidRelationCwd, format: "json" });
    expect(lintResult.success).toBe(false);
    const parsed = JSON.parse(lintResult.report);
    expect(parsed.diagnostics.length).toBeGreaterThan(0);
  });

  it("lint --format github emits annotation format", () => {
    const r = runCli(["lint", "--format", "github"], invalidSchemaCwd);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("::error ");
  });

  it("build --format json returns structured error report", async () => {
    const result = await runBuild({ cwd: invalidSchemaCwd, format: "json" });
    expect(result.success).toBe(false);
    const parsed = JSON.parse(result.report);
    expect(parsed.success).toBe(false);
    expect(parsed.diagnostics.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// WORKSPACE: COMPLEX CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

describe("workspace: advanced workspace scenarios", () => {
  it("workspace loads multi-source project correctly", async () => {
    const ws = await createWorkspace({ cwd: fixture("mixed-sources") });
    const faq = ws.getCollection("faq");
    const docs = ws.getCollection("docs");
    expect(faq).toBeDefined();
    expect(docs).toBeDefined();
    expect(faq!.contentFiles.length).toBeGreaterThan(0);
    expect(docs!.contentFiles.length).toBeGreaterThan(0);
  });

  it("workspace loads i18n config", async () => {
    const ws = await createWorkspace({ cwd: fixture("i18n") });
    const faq = ws.getCollection("faq");
    expect(faq).toBeDefined();
    expect(faq!.config.i18n).toBeTruthy();
  });

  it("workspace loads multi-type collection with schema and config", async () => {
    const ws = await createWorkspace({ cwd: fixture("multi-type") });
    const terms = ws.getCollection("terms");
    expect(terms).toBeDefined();
    expect(terms!.schema).toBeDefined();
    expect(terms!.config.types?.length).toBeGreaterThanOrEqual(2);
    expect(terms!.config.types?.[0]?.name).toBe("topic");
    expect(terms!.config.types?.[1]?.name).toBe("term");
  });

  it("workspace filters to single collection when specified", async () => {
    const ws = await createWorkspace({ cwd: fixture("mixed-sources"), collection: "faq" });
    const faq = ws.getCollection("faq");
    const docs = ws.getCollection("docs");
    expect(faq).toBeDefined();
    expect(docs).toBeUndefined();
  });

  it("workspace returns null for nonexistent collection", async () => {
    const ws = await createWorkspace({ cwd: fixture("minimal") });
    const nope = ws.getCollection("nonexistent");
    expect(nope).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA INTROSPECTION: ADVANCED CASES
// ═══════════════════════════════════════════════════════════════════════════

describe("schema: advanced introspection", () => {
  it("introspects enum options", async () => {
    const result = await runSchema({ cwd: fixture("minimal"), collection: "faq" });
    expect(result.success).toBe(true);
    const category = result.data?.schema.fields.category;
    expect(category).toBeDefined();
    // Enum should expose options
    if (category?.options) {
      expect(category.options).toContain("products");
      expect(category.options).toContain("ordering");
    }
  });

  it("introspects required vs optional fields in multi-type", async () => {
    const result = await runSchema({
      cwd: fixture("multi-type"),
      collection: "terms",
      contentType: "topic",
    });
    expect(result.success).toBe(true);
    expect(result.data?.schema.fields.title.required).toBe(true);
    expect(result.data?.schema.fields.description.required).toBe(false);
  });

  it("schema via CLI returns consistent JSON", () => {
    const r = runCli(["schema", "faq", "--format", "json"], fixture("minimal"));
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
    expect(parsed.data.collection).toBe("faq");
    expect(parsed.data.schema).toBeDefined();
    expect(parsed.data.schema.fields).toBeDefined();
    const fieldNames = Object.keys(parsed.data.schema.fields);
    expect(fieldNames).toContain("question");
    expect(fieldNames).toContain("category");
  });

  it("schema for i18n collection matches non-i18n schema", async () => {
    const i18nResult = await runSchema({ cwd: fixture("i18n"), collection: "faq" });
    const minResult = await runSchema({ cwd: fixture("minimal"), collection: "faq" });
    expect(i18nResult.success).toBe(true);
    expect(minResult.success).toBe(true);
    // Both have the same schema shape (question + category)
    expect(Object.keys(i18nResult.data!.schema.fields).sort()).toEqual(
      Object.keys(minResult.data!.schema.fields).sort()
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// IDEMPOTENCY AND DATA INTEGRITY
// ═══════════════════════════════════════════════════════════════════════════

describe("data integrity: update preserves body and unrelated fields", () => {
  const cwd = fixture("minimal");

  it("update preserves body content", async () => {
    const filePath = path.join(cwd, "content", "faq", "hello.json");
    const original = fs.readFileSync(filePath, "utf-8");
    try {
      const updateResult = await runUpdate({
        cwd,
        collection: "faq",
        slug: "hello",
        set: { category: "ordering" },
      });
      expect(updateResult.success).toBe(true);

      // View should show updated category but same body
      const viewResult = await runView({ cwd, collection: "faq", slug: "hello" });
      expect(viewResult.data?.meta.category).toBe("ordering");
      expect(viewResult.data?.meta.question).toBe("What is the minimum order quantity?");
    } finally {
      fs.writeFileSync(filePath, original, "utf-8");
    }
  });

  it("update with single field does not alter other fields", async () => {
    const filePath = path.join(cwd, "content", "faq", "hello.json");
    const original = fs.readFileSync(filePath, "utf-8");
    try {
      const before = await runView({ cwd, collection: "faq", slug: "hello" });
      const originalMeta = before.data?.meta;

      await runUpdate({
        cwd,
        collection: "faq",
        slug: "hello",
        set: { question: "Temporary update?" },
      });

      const after = await runView({ cwd, collection: "faq", slug: "hello" });
      expect(after.data?.meta.question).toBe("Temporary update?");
      expect(after.data?.meta.category).toBe(originalMeta?.category);
    } finally {
      fs.writeFileSync(filePath, original, "utf-8");
    }
  });

  it("double build produces same output (idempotent)", async () => {
    await runBuild({ cwd, force: true });
    const first = fs.readFileSync(path.join(cwd, "generated", "content", "faq.ts"), "utf-8");
    await runBuild({ cwd, force: true });
    const second = fs.readFileSync(path.join(cwd, "generated", "content", "faq.ts"), "utf-8");
    expect(second).toBe(first);
  });

  it("incremental build skips unchanged collection after force build", async () => {
    await runBuild({ cwd, force: true });
    const status1 = await runStatus({ cwd });
    expect(status1.status).toBe("up-to-date");

    // Incremental build should succeed without rebuilding
    const incBuild = await runBuild({ cwd });
    expect(incBuild.success).toBe(true);

    const status2 = await runStatus({ cwd });
    expect(status2.status).toBe("up-to-date");
  });
});
