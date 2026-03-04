import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validateMeta, validateRelations, detectCircularReferences } from "./validator.js";

describe("validateMeta", () => {
  it("returns valid when meta matches schema", () => {
    const schema = z.object({ title: z.string(), count: z.number() });
    const result = validateMeta({ title: "Hi", count: 1 }, schema as never, "test.mdx");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns errors when meta fails validation", () => {
    const schema = z.object({ title: z.string().min(1), count: z.number() });
    const result = validateMeta({ title: "", count: "not-a-number" }, schema as never, "test.mdx");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatchObject({
      file: "test.mdx",
      field: expect.any(String),
      message: expect.any(String),
    });
  });
});

describe("validateRelations", () => {
  it("reports missing slug in target collection", () => {
    const collectionSlugs = new Map<string, Set<string>>();
    collectionSlugs.set("faq", new Set(["moq", "lead-time"]));
    const result = validateRelations(
      { relatedFaqs: ["moq", "nonexistent"] },
      "my.mdx",
      { relatedFaqs: "faq" },
      collectionSlugs,
      "my"
    );
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("nonexistent");
    expect(result.errors[0].missingSlug).toBe("nonexistent");
    expect(result.errors[0].targetCollection).toBe("faq");
  });

  it("adds warning for self-reference", () => {
    const collectionSlugs = new Map<string, Set<string>>();
    collectionSlugs.set("faq", new Set(["moq"]));
    const result = validateRelations(
      { relatedFaqs: ["moq"] },
      "moq.en.mdx",
      { relatedFaqs: "faq" },
      collectionSlugs,
      "moq"
    );
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain("Self-reference");
  });
});

describe("detectCircularReferences", () => {
  it("detects self-references", () => {
    const items = new Map<string, { slug: string; relatedSlugs: string[] }>();
    items.set("a", { slug: "a", relatedSlugs: ["a"] });
    const { selfRefs } = detectCircularReferences(items);
    expect(selfRefs).toContain("a");
  });

  it("detects circular refs", () => {
    const items = new Map<string, { slug: string; relatedSlugs: string[] }>();
    items.set("a", { slug: "a", relatedSlugs: ["b"] });
    items.set("b", { slug: "b", relatedSlugs: ["a"] });
    const { circularRefs } = detectCircularReferences(items);
    expect(circularRefs.length).toBeGreaterThan(0);
    expect(circularRefs.some((c) => c.includes("a") && c.includes("b"))).toBe(true);
  });
});
