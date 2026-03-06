import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runBuild } from "./run-build.js";
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

describe("runBuild", () => {
  it("generates flat collection and index files for a valid project", async () => {
    const cwd = await useFixture("minimal");

    const result = await runBuild({ cwd });

    expect(result.success).toBe(true);
    expect(result.errors).toBe(0);
    expect(result.diagnostics).toEqual([]);
    expect(result.generated).toEqual(["faq.ts", "index.ts"]);
    expect(result.report).toContain("Build diagnostics");
    expect(result.report).toContain("0 error(s), 0 warning(s), 0 info message(s)");

    const collectionOutput = await fs.readFile(
      path.join(cwd, "generated", "content", "faq.ts"),
      "utf-8"
    );
    const indexOutput = await fs.readFile(
      path.join(cwd, "generated", "content", "index.ts"),
      "utf-8"
    );

    expect(collectionOutput).toContain("export interface FaqMeta");
    expect(collectionOutput).toContain('question": "What is the minimum order quantity?"');
    expect(collectionOutput).toContain("export const faqStats = {");
    expect(indexOutput).toContain('export { faq, faqSlugs, faqStats } from "./faq.js";');
    expect(indexOutput).toContain('export type { FaqMeta, FaqEntry } from "./faq.js";');
  });

  it("returns a failed result and skips collection output when validation fails", async () => {
    const cwd = await useFixture("invalid-schema");

    const result = await runBuild({ cwd });

    expect(result.success).toBe(false);
    expect(result.errors).toBe(1);
    expect(result.generated).toEqual(["index.ts"]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "META_VALIDATION_FAILED",
        severity: "error",
        category: "validation",
        collection: "faq",
        file: "short.mdx",
        field: "question",
      })
    );
    expect(result.report).toContain("META_VALIDATION_FAILED");
    expect(result.report).toContain("String must contain at least 10 character(s)");

    await expect(fs.access(path.join(cwd, "generated", "content", "faq.ts"))).rejects.toThrow();

    const indexOutput = await fs.readFile(
      path.join(cwd, "generated", "content", "index.ts"),
      "utf-8"
    );
    expect(indexOutput).not.toContain('from "./faq.js"');
  });

  it("generates multi-type exports and index wiring for typed collections", async () => {
    const cwd = await useFixture("multi-type");

    const result = await runBuild({ cwd });

    expect(result.success).toBe(true);
    expect(result.generated).toEqual(["terms.ts", "index.ts"]);

    const collectionOutput = await fs.readFile(
      path.join(cwd, "generated", "content", "terms.ts"),
      "utf-8"
    );
    const indexOutput = await fs.readFile(
      path.join(cwd, "generated", "content", "index.ts"),
      "utf-8"
    );

    expect(collectionOutput).toContain("export const terms: Record<string, TermItem> =");
    expect(collectionOutput).toContain("export const topics: Record<string, TopicItem> =");
    expect(collectionOutput).toContain("topic-getting-started");
    expect(indexOutput).toContain('export { terms, termsSlugs, termsStats } from "./terms.js";');
    expect(indexOutput).toContain('export { topics, topicsSlugs, topicsStats } from "./terms.js";');
    expect(indexOutput).toContain(
      'export type { TopicMeta, TopicEntry, TopicItem } from "./terms.js";'
    );
  });

  it("renders JSON diagnostics output", async () => {
    const cwd = await useFixture("invalid-schema");

    const result = await runBuild({ cwd, format: "json" });
    const parsed = JSON.parse(result.report) as {
      title: string;
      success: boolean;
      summary: { errors: number; warnings: number; info: number };
      diagnostics: Array<{ code: string; severity: string; category: string }>;
      generated: string[];
    };

    expect(parsed.title).toBe("Build diagnostics");
    expect(parsed.success).toBe(false);
    expect(parsed.summary).toEqual({ errors: 1, warnings: 0, info: 0 });
    expect(parsed.generated).toEqual(["index.ts"]);
    expect(parsed.diagnostics).toEqual([
      expect.objectContaining({
        code: "META_VALIDATION_FAILED",
        severity: "error",
        category: "validation",
      }),
    ]);
  });

  it("renders GitHub diagnostics output", async () => {
    const cwd = await useFixture("invalid-schema");

    const result = await runBuild({ cwd, format: "github" });

    expect(result.report).toContain("::error ");
    expect(result.report).toContain("title=META_VALIDATION_FAILED");
    expect(result.report).toContain("short.mdx");
    expect(result.report).toContain("String must contain at least 10 character(s)");
  });

  it("discovers collections from mixed source patterns", async () => {
    const cwd = await useFixture("mixed-sources");

    const result = await runBuild({ cwd });

    expect(result.success).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.generated).toEqual(["docs.ts", "faq.ts", "index.ts"]);

    const docsOutput = await fs.readFile(
      path.join(cwd, "generated", "content", "docs.ts"),
      "utf-8"
    );
    const faqOutput = await fs.readFile(path.join(cwd, "generated", "content", "faq.ts"), "utf-8");
    const indexOutput = await fs.readFile(
      path.join(cwd, "generated", "content", "index.ts"),
      "utf-8"
    );

    expect(docsOutput).toContain('"title": "Getting started"');
    expect(faqOutput).toContain('"question": "What is contenz?"');
    expect(indexOutput).toContain('export { docs, docsSlugs, docsStats } from "./docs.js";');
    expect(indexOutput).toContain('export { faq, faqSlugs, faqStats } from "./faq.js";');
  });
});
