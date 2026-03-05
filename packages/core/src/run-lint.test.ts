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
    expect(result.coveragePath).toBe(path.join(cwd, "content.coverage.md"));
    expect(result.report).toContain("Lint passed.");
    expect(result.report).toContain("faq: 1 items (EN: 1, ZH: 1)");

    const coverageOutput = await fs.readFile(path.join(cwd, "content.coverage.md"), "utf-8");
    expect(coverageOutput).toContain("# Content Coverage Report");
    expect(coverageOutput).toContain("| faq | 1 | 1 | 1 | 1 | 100% |");
    expect(coverageOutput).toContain("All translations complete.");
  });

  it("returns a failing result when schema validation errors are present", async () => {
    const cwd = await useFixture("invalid-schema");

    const result = await runLint({ cwd });

    expect(result.success).toBe(false);
    expect(result.errors).toBeGreaterThan(0);
    expect(result.report).toContain("Lint failed");
    expect(result.report).toContain("question");
  });

  it("reports relation failures when referenced slugs are missing", async () => {
    const cwd = await useFixture("invalid-relation");

    const result = await runLint({ cwd });

    expect(result.success).toBe(false);
    expect(result.errors).toBeGreaterThan(0);
    expect(result.report).toContain("Relation Validation");
    expect(result.report).toMatch(/nonexistent-slug|not found/);
  });
});
