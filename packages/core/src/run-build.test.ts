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
        file: "short.json",
        field: "question",
      })
    );
    expect(result.report).toContain("META_VALIDATION_FAILED");
    expect(result.report).toContain("Too small");

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
      success: boolean;
      data: {
        title: string;
        summary: { errors: number; warnings: number; info: number };
        generated: string[];
      };
      diagnostics: Array<{ code: string; severity: string; category: string }>;
    };

    expect(parsed.data.title).toBe("Build diagnostics");
    expect(parsed.success).toBe(false);
    expect(parsed.data.summary).toEqual({ errors: 1, warnings: 0, info: 0 });
    expect(parsed.data.generated).toEqual(["index.ts"]);
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
    expect(result.report).toContain("short.json");
    expect(result.report).toContain("Too small");
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

  it("dryRun returns success and generated list but does not write files", async () => {
    const cwd = await useFixture("minimal");
    const outDir = path.join(cwd, "generated", "content");
    const faqPath = path.join(outDir, "faq.ts");
    if (
      await fs
        .access(faqPath)
        .then(() => true)
        .catch(() => false)
    ) {
      await fs.unlink(faqPath);
    }

    const result = await runBuild({ cwd, dryRun: true });

    expect(result.success).toBe(true);
    expect(result.generated).toContain("faq.ts");
    expect(result.generated).toContain("index.ts");
    await expect(fs.access(faqPath)).rejects.toThrow();
  });

  it("force rebuilds all collections (ignores manifest)", async () => {
    const cwd = await useFixture("minimal");
    await runBuild({ cwd });
    const manifestPath = path.join(cwd, ".contenz", "build-manifest.json");
    const firstBuildFaq = await fs.readFile(
      path.join(cwd, "generated", "content", "faq.ts"),
      "utf-8"
    );

    const result = await runBuild({ cwd, force: true });

    expect(result.success).toBe(true);
    const secondBuildFaq = await fs.readFile(
      path.join(cwd, "generated", "content", "faq.ts"),
      "utf-8"
    );
    expect(secondBuildFaq).toBe(firstBuildFaq);
    const manifestExists = await fs
      .access(manifestPath)
      .then(() => true)
      .catch(() => false);
    expect(manifestExists).toBe(true);
  });

  it("incremental build skips unchanged collections and writes manifest", async () => {
    const cwd = await useFixture("minimal");
    const manifestPath = path.join(cwd, ".contenz", "build-manifest.json");
    const faqPath = path.join(cwd, "generated", "content", "faq.ts");

    const first = await runBuild({ cwd });
    expect(first.success).toBe(true);
    const firstFaqContent = await fs.readFile(faqPath, "utf-8");

    const second = await runBuild({ cwd });
    expect(second.success).toBe(true);
    const secondFaqContent = await fs.readFile(faqPath, "utf-8");
    const secondManifest = await fs.readFile(manifestPath, "utf-8");

    expect(secondFaqContent).toBe(firstFaqContent);
    const manifestData = JSON.parse(secondManifest) as {
      collections: Array<{ name: string; inputHash: string }>;
    };
    expect(manifestData.collections).toHaveLength(1);
    expect(manifestData.collections[0].name).toBe("faq");
    expect(manifestData.collections[0].inputHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("incremental build rebuilds only changed collection", async () => {
    const cwd = await useFixture("mixed-sources");
    const docsPath = path.join(cwd, "generated", "content", "docs.ts");
    const faqPath = path.join(cwd, "generated", "content", "faq.ts");
    const faqContentPath = path.join(cwd, "content", "faq", "hello.json");

    await runBuild({ cwd });
    const docsBefore = await fs.readFile(docsPath, "utf-8");
    const faqBefore = await fs.readFile(faqPath, "utf-8");

    const originalFaqContent = await fs.readFile(faqContentPath, "utf-8");
    await fs.writeFile(
      faqContentPath,
      originalFaqContent.replace("What is contenz?", "What is contenz? (updated)"),
      "utf-8"
    );
    const result = await runBuild({ cwd });
    await fs.writeFile(faqContentPath, originalFaqContent, "utf-8");

    expect(result.success).toBe(true);
    const docsAfter = await fs.readFile(docsPath, "utf-8");
    const faqAfter = await fs.readFile(faqPath, "utf-8");
    expect(docsAfter).toBe(docsBefore);
    expect(faqAfter).not.toBe(faqBefore);
    expect(faqAfter).toContain("(updated)");
  });
});
