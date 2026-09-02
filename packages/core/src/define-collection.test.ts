import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  defineCollection,
  defineMultiTypeCollection,
} from "./define-collection.js";

describe("defineCollection (single-type)", () => {
  it("returns meta, relations, and computed", () => {
    const schema = z.object({ title: z.string() });
    const out = defineCollection({
      schema,
      relations: { links: "glossary" },
      computed: { readingTime: () => 1 },
    });
    expect(out.meta).toBe(schema);
    expect(out.relations).toEqual({ links: "glossary" });
    expect(out.computed).toBeDefined();
  });

  it("omits relations and computed when empty", () => {
    const out = defineCollection({ schema: z.object({}) });
    expect(out.relations).toBeUndefined();
    expect(out.computed).toBeUndefined();
  });

  it("supports metaTypeName override", () => {
    const out = defineCollection({
      schema: z.object({ title: z.string() }),
      metaTypeName: "Post",
    });
    expect(out.metaTypeName).toBe("Post");
  });
});

describe("defineCollection (multi-type)", () => {
  it("exports {name}Meta per type and meta for the first type", () => {
    const term = z.object({ term: z.string() });
    const topic = z.object({ title: z.string() });
    const out = defineMultiTypeCollection({ schemas: { term, topic } });
    expect(out.termMeta).toBe(term);
    expect(out.topicMeta).toBe(topic);
    expect(out.meta).toBe(term);
    expect(out.types).toBeUndefined();
  });

  it("collects patterns into types", () => {
    const out = defineCollection({
      schemas: {
        topic: { schema: z.object({}), pattern: /^topic-/ },
        term: { schema: z.object({}), pattern: /.*/ },
      },
    });
    expect(out.types).toEqual([
      { name: "topic", pattern: /^topic-/ },
      { name: "term", pattern: /.*/ },
    ]);
  });

  it("rejects empty schemas", () => {
    expect(() => defineCollection({ schemas: {} })).toThrow(
      /at least one content type/
    );
  });

  it("rejects duplicate patterns that would shadow a type", () => {
    expect(() =>
      defineCollection({
        schemas: {
          topic: { schema: z.object({}), pattern: /.*/ },
          term: { schema: z.object({}), pattern: /.*/ },
        },
      })
    ).toThrow(/duplicate filename pattern[\s\S]*"term" would never match/);
  });

  it("rejects duplicate patterns regardless of intent", () => {
    // Two types with the same pattern: first match wins, so the second type
    // can never match. This is always an authoring error.
    expect(() =>
      defineCollection({
        schemas: {
          topic: { schema: z.object({}), pattern: /^topic-/ },
          term: { schema: z.object({}), pattern: /^topic-/ },
        },
      })
    ).toThrow(/duplicate filename pattern/);
  });
});
