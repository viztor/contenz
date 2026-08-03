import fs from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runLint } from "./run-lint.js";
import { prepareFixture } from "./test-fixtures.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs
      .splice(0)
      .map( async (dir) => fs.rm(dir, { recursive: true, force: true }))
  );
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
    expect(result.report).toContain(
      "0 error(s), 0 warning(s), 0 info message(s)"
    );
    expect(result.report).toContain("Coverage report: contenz.coverage.md");

    const coverageOutput = await fs.readFile(
      path.join(cwd, "contenz.coverage.md"),
      "utf-8"
    );
    expect(coverageOutput).toContain("# Content Coverage Report");
    expect(coverageOutput).toContain("| faq | 1 | 1 | 1 | 1 | 100% |");
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

  describe("i18n missing translations (declared locales)", () => {
    it("does not check translations by default, even with declared locales", async () => {
      const cwd = await useFixture("i18n-partial");

      const result = await runLint({ cwd });

      expect(result.success).toBe(true);
      expect(result.diagnostics.filter((d) => d.category === "i18n")).toEqual(
        []
      );
    });

    it("emits per-slug warnings against declared locales with the source file", async () => {
      const cwd = await useFixture("i18n-partial");

      const result = await runLint({ cwd, translations: true });

      // Non-strict: warnings only, lint still succeeds
      expect(result.success).toBe(true);
      expect(result.errors).toBe(0);

      const missing = result.diagnostics.filter(
        (d) => d.code === "I18N_MISSING_TRANSLATION"
      );
      expect(missing).toHaveLength(3);
      expect(missing).toContainEqual(
        expect.objectContaining({
          severity: "warning",
          category: "i18n",
          collection: "faq",
          slug: "moq",
          locale: "ja",
          file: "moq.en.json",
        })
      );
      expect(missing).toContainEqual(
        expect.objectContaining({
          slug: "hello",
          locale: "zh",
          file: "hello.en.json",
        })
      );
      expect(missing).toContainEqual(
        expect.objectContaining({
          slug: "hello",
          locale: "ja",
          file: "hello.en.json",
        })
      );
    });

    it("emits a coverage threshold warning when complete-slug ratio is below threshold", async () => {
      const cwd = await useFixture("i18n-partial");

      const result = await runLint({ cwd, translations: true });

      // 0 of 2 slugs have all three declared locales; threshold is 0.8
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: "I18N_COVERAGE_BELOW_THRESHOLD",
          severity: "warning",
          category: "i18n",
          collection: "faq",
        })
      );
    });

    it("escalates to errors and fails lint in strict mode", async () => {
      const cwd = await useFixture("i18n-partial");
      const configPath = path.join(cwd, "contenz.config.ts");
      const config = await fs.readFile(configPath, "utf-8");
      await fs.writeFile(
        configPath,
        config.replace("strict: false", "strict: true"),
        "utf-8"
      );

      const result = await runLint({ cwd, translations: true });

      expect(result.success).toBe(false);
      // 3 missing translations + 1 threshold breach
      expect(result.errors).toBe(4);
      expect(
        result.diagnostics.filter(
          (d) => d.code === "I18N_MISSING_TRANSLATION" && d.severity === "error"
        )
      ).toHaveLength(3);
    });

    it("does not emit missing-translation diagnostics when locales are not declared", async () => {
      // The i18n fixture uses `i18n: true` (no declared locales) — inferred mode
      // stays report-only even with the translations check enabled
      const cwd = await useFixture("i18n");

      const result = await runLint({ cwd, translations: true });

      expect(
        result.diagnostics.filter((d) => d.code === "I18N_MISSING_TRANSLATION")
      ).toEqual([]);
    });

    it("seeds declared locales into the coverage report", async () => {
      const cwd = await useFixture("i18n-partial");

      const result = await runLint({ cwd, coverage: true });

      const coverageOutput = await fs.readFile(
        path.join(cwd, "contenz.coverage.md"),
        "utf-8"
      );
      // JA column exists with 0 files even though no .ja.json file is present
      expect(coverageOutput).toContain("| faq | 2 | 2 | 0 | 1 | 0 | 0% |");
      expect(coverageOutput).toContain("JA: 2 missing translation(s)");
      expect(result.coveragePath).toBe(path.join(cwd, "contenz.coverage.md"));
    });
  });
});
