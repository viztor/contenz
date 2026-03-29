import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runLint } from "./run-lint.js";
import { prepareFixture } from "./test-fixtures.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function useFixture(name: string): Promise<string> {
  const dir = await prepareFixture(name);
  tempDirs.push(dir);
  return dir;
}

describe("runLint", () => {
  it("returns success and writes coverage output for a valid i18n project", async () => {
    const cwd = await useFixture("i18n");

    const result = await runLint({ cwd, coverage: true });

    expect(result.success).toBe(true);
    expect(result.errors).toBe(0);
    expect(result.diagnostics).toEqual([]);
    expect(result.coveragePath).toBe(path.join(cwd, "contenz.coverage.md"));
    expect(result.report).toContain("Lint diagnostics");
    expect(result.report).toContain("0 error(s), 0 warning(s), 0 info message(s)");
    expect(result.report).toContain("Coverage report: contenz.coverage.md");

    const coverageOutput = await fs.readFile(path.join(cwd, "contenz.coverage.md"), "utf-8");
    expect(coverageOutput).toContain("# Content Coverage Report");
    expect(coverageOutput).toContain("| faq | 2 | 2 | 2 | 2 | 100% |");
    expect(coverageOutput).toContain("All translations complete.");
  });

  it("returns a failing result when schema validation errors are present", async () => {
    const cwd = await useFixture("invalid-schema");

    const result = await runLint({ cwd });

    expect(result.success).toBe(false);
    expect(result.errors).toBeGreaterThan(0);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "META_VALIDATION_FAILED",
        severity: "error",
        category: "validation",
        collection: "faq",
        file: "short.json",
        field: "question",
      })
    );
    expect(result.report).toContain("META_VALIDATION_FAILED");
    expect(result.report).toContain("Too small");
  });

  it("reports relation failures when referenced slugs are missing", async () => {
    const cwd = await useFixture("invalid-relation");

    const result = await runLint({ cwd });

    expect(result.success).toBe(false);
    expect(result.errors).toBeGreaterThan(0);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "RELATION_MISSING_SLUG",
        severity: "error",
        category: "relation",
      })
    );
    expect(result.report).toContain("RELATION_MISSING_SLUG");
    expect(result.report).toMatch(/nonexistent-slug|not found/);
  });

  it("renders JSON diagnostics output", async () => {
    const cwd = await useFixture("invalid-relation");

    const result = await runLint({ cwd, format: "json" });
    const parsed = JSON.parse(result.report) as {
      success: boolean;
      data: {
        title: string;
        summary: { errors: number; warnings: number; info: number };
      };
      diagnostics: Array<{ code: string; severity: string; category: string }>;
    };

    expect(parsed.data.title).toBe("Lint diagnostics");
    expect(parsed.success).toBe(false);
    expect(parsed.data.summary.errors).toBeGreaterThan(0);
    expect(parsed.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "RELATION_MISSING_SLUG",
        severity: "error",
        category: "relation",
      })
    );
  });

  it("renders GitHub diagnostics output", async () => {
    const cwd = await useFixture("invalid-relation");

    const result = await runLint({ cwd, format: "github" });

    expect(result.report).toContain("::error ");
    expect(result.report).toContain("title=RELATION_MISSING_SLUG");
    expect(result.report).toContain("moq.json");
    expect(result.report).toMatch(/nonexistent-slug|not found/);
  });

  it("lints collections discovered from mixed source patterns", async () => {
    const cwd = await useFixture("mixed-sources");

    const result = await runLint({ cwd });

    expect(result.success).toBe(true);
    expect(result.errors).toBe(0);
    expect(result.diagnostics).toEqual([]);
    expect(result.report).toContain("Sources: content/*, docs");
  });

  it("dryRun with coverage does not write coverage file", async () => {
    const cwd = await useFixture("i18n");
    const coveragePath = path.join(cwd, "contenz.coverage.md");
    try {
      await fs.unlink(coveragePath);
    } catch {}

    const result = await runLint({ cwd, coverage: true, dryRun: true });

    expect(result.success).toBe(true);
    expect(result.report).toContain("Lint diagnostics");
    await expect(fs.access(coveragePath)).rejects.toThrow();
  });
});
