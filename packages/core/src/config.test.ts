import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConfig } from "./config.js";
import { discoverCollections, normalizeSourcePattern } from "./sources.js";
import type { CollectionConfig, ContenzConfig, ResolvedConfig } from "./types.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function createTempProject(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "contenz-config-"));
  tempDirs.push(dir);
  return dir;
}

describe("resolveConfig", () => {
  it("returns built-in defaults when project config empty", () => {
    const resolved = resolveConfig({});
    expect(resolved.sources).toEqual(["content/*"]);
    expect(resolved.outputDir).toBe("generated/content");
    expect(resolved.coveragePath).toBe("contenz.coverage.md");
    expect(resolved.i18n).toBe(false);
    expect(resolved.extensions).toEqual(["md", "mdx"]);
    expect(resolved.ignore).toEqual(["README.md", "_*"]);
  });

  it("normalizes project source overrides", () => {
    const project: ContenzConfig = {
      sources: ["./content/*", "docs"],
      i18n: true,
      extensions: ["md"],
    };
    const resolved = resolveConfig(project);
    expect(resolved.sources).toEqual(["content/*", "docs"]);
    expect(resolved.i18n).toBe(true);
    expect(resolved.extensions).toEqual(["md"]);
  });

  it("maps legacy contentDir to a child source pattern", () => {
    const project: ContenzConfig = {
      contentDir: "src/content",
    };
    const resolved = resolveConfig(project);
    expect(resolved.sources).toEqual(["src/content/*"]);
  });

  it("collection overrides project values", () => {
    const project: ContenzConfig = { i18n: true };
    const collection: CollectionConfig = { i18n: false, extensions: ["mdx"] };
    const resolved = resolveConfig(project, collection);
    expect(resolved.i18n).toBe(false);
    expect(resolved.extensions).toEqual(["mdx"]);
  });

  it("normalizes i18n rich config: boolean true", () => {
    const project: ContenzConfig = { i18n: true };
    const resolved = resolveConfig(project);
    expect(resolved.i18n).toBe(true);
    expect(resolved.resolvedI18n).toBeDefined();
    expect(resolved.resolvedI18n?.enabled).toBe(true);
    expect(resolved.resolvedI18n?.defaultLocale).toBeNull();
    expect(resolved.resolvedI18n?.coverageThreshold).toBeNull();
  });

  it("normalizes i18n rich config: shape with defaultLocale and coverageThreshold", () => {
    const project: ContenzConfig = {
      i18n: {
        enabled: true,
        defaultLocale: "en",
        locales: ["en", "zh"],
        coverageThreshold: 0.8,
        includeFallbackMetadata: true,
      },
    };
    const resolved = resolveConfig(project);
    expect(resolved.i18n).toBe(true);
    expect(resolved.resolvedI18n?.defaultLocale).toBe("en");
    expect(resolved.resolvedI18n?.locales).toEqual(["en", "zh"]);
    expect(resolved.resolvedI18n?.coverageThreshold).toBe(0.8);
    expect(resolved.resolvedI18n?.includeFallbackMetadata).toBe(true);
  });

  it("normalizes i18n fallback array to __default in fallbackMap", () => {
    const project: ContenzConfig = {
      i18n: { enabled: true, fallback: ["en"] },
    };
    const resolved = resolveConfig(project);
    expect(resolved.resolvedI18n?.fallbackMap).toEqual({ __default: "en" });
  });

  it("normalizes i18n fallback record", () => {
    const project: ContenzConfig = {
      i18n: { enabled: true, fallback: { "zh-Hant": "zh", zh: "en" } },
    };
    const resolved = resolveConfig(project);
    expect(resolved.resolvedI18n?.fallbackMap).toEqual({ "zh-Hant": "zh", zh: "en" });
  });
});

describe("normalizeSourcePattern", () => {
  it("accepts self and child discovery patterns", () => {
    expect(normalizeSourcePattern("docs")).toBe("docs");
    expect(normalizeSourcePattern("./content/*")).toBe("content/*");
  });

  it("rejects unsupported glob syntax", () => {
    expect(() => normalizeSourcePattern("content/**")).toThrow(/Unsupported source pattern/);
    expect(() => normalizeSourcePattern("content/*/nested")).toThrow(/Unsupported source pattern/);
  });
});

describe("discoverCollections", () => {
  it("discovers collections from mixed source patterns", async () => {
    const cwd = await createTempProject();

    await fs.mkdir(path.join(cwd, "content", "faq"), { recursive: true });
    await fs.writeFile(path.join(cwd, "content", "faq", "schema.ts"), "export const meta = {};\n");
    await fs.mkdir(path.join(cwd, "docs"), { recursive: true });
    await fs.writeFile(path.join(cwd, "docs", "schema.ts"), "export const meta = {};\n");

    const result = await discoverCollections(cwd, ["content/*", "docs"]);

    expect(result.errors).toEqual([]);
    expect(result.collections.map((collection) => collection.name)).toEqual(["docs", "faq"]);
    expect(
      result.collections.map((collection) => path.relative(cwd, collection.collectionPath))
    ).toEqual(["docs", "content/faq"]);
  });

  it("reports duplicate collection names across sources", async () => {
    const cwd = await createTempProject();

    await fs.mkdir(path.join(cwd, "content", "docs"), { recursive: true });
    await fs.writeFile(path.join(cwd, "content", "docs", "schema.ts"), "export const meta = {};\n");
    await fs.mkdir(path.join(cwd, "docs"), { recursive: true });
    await fs.writeFile(path.join(cwd, "docs", "schema.ts"), "export const meta = {};\n");

    const result = await discoverCollections(cwd, ["content/*", "docs"]);

    expect(result.collections.map((collection) => collection.name)).toEqual(["docs"]);
    expect(result.errors).toEqual([
      'Collection "docs" was discovered from both "content/*" and "docs". Collection names must be unique across sources.',
    ]);
  });
});

describe("getContentType", () => {
  it("returns undefined when no types in config", async () => {
    const { getContentType } = await import("./config.js");
    const config = { types: undefined } as ResolvedConfig;
    expect(getContentType("anything.mdx", config)).toBeUndefined();
  });

  it("returns type name when pattern matches", async () => {
    const { getContentType } = await import("./config.js");
    const config: ResolvedConfig = {
      sources: ["content/*"],
      outputDir: "generated/content",
      coveragePath: "contenz.coverage.md",
      strict: false,
      i18n: true,
      extensions: ["md", "mdx"],
      ignore: [],
      types: [
        { name: "topic", pattern: /^topic-/ },
        { name: "term", pattern: /.*/ },
      ],
    };
    expect(getContentType("topic-intro.mdx", config)).toBe("topic");
    expect(getContentType("glossary-term.mdx", config)).toBe("term");
  });
});

describe("getSchemaForType", () => {
  it("returns meta for default/single-type", async () => {
    const { getSchemaForType } = await import("./config.js");
    const meta = {} as import("zod").ZodSchema;
    const module = { meta };
    expect(getSchemaForType(module, undefined)).toBe(meta);
    expect(getSchemaForType(module, "default")).toBe(meta);
  });

  it("returns typeMeta when present", async () => {
    const { getSchemaForType } = await import("./config.js");
    const meta = {} as import("zod").ZodSchema;
    const termMeta = {} as import("zod").ZodSchema;
    const module = { meta, termMeta };
    expect(getSchemaForType(module, "term")).toBe(termMeta);
  });
});

describe("extractRelations", () => {
  it("returns explicit relations when provided", async () => {
    const { extractRelations } = await import("./config.js");
    const module = { relations: { featuredTerms: "terms" } };
    expect(extractRelations(module as never, ["terms"])).toEqual({
      featuredTerms: "terms",
    });
  });

  it("auto-detects relatedCollection fields from schema shape", async () => {
    const { extractRelations } = await import("./config.js");
    const shape = {
      relatedFaq: {},
      relatedTerm: {},
      title: {},
    };
    const meta = {
      _def: { shape: () => shape },
    };
    const module = { meta, relations: undefined };
    const result = extractRelations(module as never, ["faq", "term"]);
    expect(result.relatedFaq).toBe("faq");
    expect(result.relatedTerm).toBe("term");
    expect(result.title).toBeUndefined();
  });
});
