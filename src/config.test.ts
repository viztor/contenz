import { describe, expect, it } from "vitest";
import { extractRelations, getContentType, getSchemaForType, resolveConfig } from "./config.js";
import type { CollectionConfig, ProjectConfig, ResolvedConfig } from "./types.js";

describe("resolveConfig", () => {
  it("returns built-in defaults when project config empty", () => {
    const resolved = resolveConfig({});
    expect(resolved.contentDir).toBe("content");
    expect(resolved.outputDir).toBe("generated/content");
    expect(resolved.coveragePath).toBe("content.coverage.md");
    expect(resolved.i18n).toBe(false);
    expect(resolved.extensions).toEqual(["md", "mdx"]);
    expect(resolved.ignore).toEqual(["README.md", "_*"]);
  });

  it("merges project overrides", () => {
    const project: ProjectConfig = {
      contentDir: "src/content",
      i18n: true,
      extensions: ["md"],
    };
    const resolved = resolveConfig(project);
    expect(resolved.contentDir).toBe("src/content");
    expect(resolved.i18n).toBe(true);
    expect(resolved.extensions).toEqual(["md"]);
  });

  it("collection overrides project", () => {
    const project: ProjectConfig = { i18n: true };
    const collection: CollectionConfig = { i18n: false, extensions: ["mdx"] };
    const resolved = resolveConfig(project, undefined, collection);
    expect(resolved.i18n).toBe(false);
    expect(resolved.extensions).toEqual(["mdx"]);
  });
});

describe("getContentType", () => {
  it("returns undefined when no types in config", () => {
    const config = { types: undefined } as ResolvedConfig;
    expect(getContentType("anything.mdx", config)).toBeUndefined();
  });

  it("returns type name when pattern matches", () => {
    const config: ResolvedConfig = {
      contentDir: "content",
      outputDir: "generated/content",
      coveragePath: "content.coverage.md",
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
  it("returns meta for default/single-type", () => {
    const meta = {} as import("zod").ZodSchema;
    const module = { meta };
    expect(getSchemaForType(module, undefined)).toBe(meta);
    expect(getSchemaForType(module, "default")).toBe(meta);
  });

  it("returns typeMeta when present", () => {
    const meta = {} as import("zod").ZodSchema;
    const termMeta = {} as import("zod").ZodSchema;
    const module = { meta, termMeta };
    expect(getSchemaForType(module, "term")).toBe(termMeta);
  });
});

describe("extractRelations", () => {
  it("returns explicit relations when provided", () => {
    const module = { relations: { featuredTerms: "terms" } };
    expect(extractRelations(module as never, ["terms"])).toEqual({
      featuredTerms: "terms",
    });
  });

  it("auto-detects relatedCollection fields from schema shape", () => {
    // Field names match related{Collection}; collection is lowercased (e.g. relatedFaq → faq)
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
