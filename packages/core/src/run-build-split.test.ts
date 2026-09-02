import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runBuild } from "./run-build.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs
      .splice(0)
      .map(async (dir) => fs.rm(dir, { recursive: true, force: true }))
  );
});

async function createSplitProject(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "contenz-split-"));
  tempDirs.push(dir);

  // Project config with split output and fallback chains
  await fs.writeFile(
    path.join(dir, "contenz.config.ts"),
    `export const config = {
  i18n: {
    enabled: true,
    defaultLocale: "en",
    locales: ["en", "zh"],
    fallback: { "zh-TW": ["zh", "en"], __default: ["en"] },
    includeFallbackMetadata: true,
    outputStrategy: "split",
  },
};
`,
    "utf-8"
  );

  await fs.mkdir(path.join(dir, "content", "faq"), { recursive: true });
  await fs.writeFile(
    path.join(dir, "content", "faq", "schema.ts"),
    `export const meta = { parse: (v) => v, safeParse: (v) => ({ success: true, data: v }) };
`,
    "utf-8"
  );

  // en source
  await fs.writeFile(
    path.join(dir, "content", "faq", "moq.en.json"),
    JSON.stringify({ question: "What is the MOQ?" }),
    "utf-8"
  );
  // zh translation
  await fs.writeFile(
    path.join(dir, "content", "faq", "moq.zh.json"),
    JSON.stringify({ question: "起订量是多少？" }),
    "utf-8"
  );
  // en-only slug — fr and zh-TW must fall back to en
  await fs.writeFile(
    path.join(dir, "content", "faq", "lead-time.en.json"),
    JSON.stringify({ question: "How long is the lead time?" }),
    "utf-8"
  );

  return dir;
}

describe("runBuild with outputStrategy: split", () => {
  it("generates per-locale files, shared types, resolver, and root index", async () => {
    const cwd = await createSplitProject();
    const result = await runBuild({ cwd, force: true });
    expect(result.success).toBe(true);

    const outDir = path.join(cwd, "generated", "content");
    expect(result.generated).toContain("_types.ts");
    expect(result.generated).toContain("_locale.ts");
    expect(result.generated).toContain("index.ts");
    expect(result.generated).toContain("en/faq.ts");
    expect(result.generated).toContain("zh/faq.ts");
    expect(result.generated).toContain("en/index.ts");
    expect(result.generated).toContain("zh/index.ts");

    // Per-locale data: direct hits
    const zhFaq = await fs.readFile(path.join(outDir, "zh", "faq.ts"), "utf-8");
    expect(zhFaq).toContain("起订量是多少？");
    // lead-time has no zh file — falls back through the __default chain to en
    expect(zhFaq).toContain("lead-time");
    expect(zhFaq).toContain("How long is the lead time?");
    expect(zhFaq).toContain('"_fallback": "en"');

    const enFaq = await fs.readFile(path.join(outDir, "en", "faq.ts"), "utf-8");
    expect(enFaq).toContain("What is the MOQ?");
    // Direct hits carry no fallback metadata
    expect(enFaq).not.toContain("_fallback");

    // Resolver embeds the chain map
    const resolver = await fs.readFile(
      path.join(outDir, "_locale.ts"),
      "utf-8"
    );
    expect(resolver).toContain("fallbackChains");
    expect(resolver).toContain('"zh-TW":["zh","en"]');
    expect(resolver).toContain("defaultFallbackChain");
    expect(resolver).toContain("export async function locale");
    expect(resolver).toContain("export async function getEntry");

    // Root index re-exports the resolver and types
    const rootIndex = await fs.readFile(path.join(outDir, "index.ts"), "utf-8");
    expect(rootIndex).toContain(
      'export { locale, getEntry, locales } from "./_locale.js"'
    );
  });

  it("split output is deterministic across force rebuilds", async () => {
    const cwd = await createSplitProject();
    await runBuild({ cwd, force: true });
    const first = await fs.readFile(
      path.join(cwd, "generated", "content", "zh", "faq.ts"),
      "utf-8"
    );
    await runBuild({ cwd, force: true });
    const second = await fs.readFile(
      path.join(cwd, "generated", "content", "zh", "faq.ts"),
      "utf-8"
    );
    expect(second).toBe(first);
  });

  it("accepts inline schema modules via config collections", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "contenz-inline-"));
    tempDirs.push(dir);

    // Inline schema travels through the same build path; we simulate a
    // centralized declaration by writing a config module that imports zod.
    await fs.writeFile(
      path.join(dir, "contenz.config.ts"),
      `import { z } from "zod";
export const config = {
  collections: {
    faq: {
      path: "content/faq",
      schema: z.object({ question: z.string() }),
    },
  },
};
`,
      "utf-8"
    );
    await fs.mkdir(path.join(dir, "content", "faq"), { recursive: true });
    await fs.writeFile(
      path.join(dir, "content", "faq", "hello.json"),
      JSON.stringify({ question: "Hi?" }),
      "utf-8"
    );

    const result = await runBuild({ cwd: dir, force: true });
    expect(result.success).toBe(true);
    const output = await fs.readFile(
      path.join(dir, "generated", "content", "faq.ts"),
      "utf-8"
    );
    expect(output).toContain("hello");
  });
});
