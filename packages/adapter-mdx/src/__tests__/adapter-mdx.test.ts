import { describe, expect, it } from "vitest";

import { mdxAdapter } from "../index.js";

describe("mdxAdapter", () => {
  describe("extensions", () => {
    it("handles mdx and md extensions", () => {
      expect(mdxAdapter.extensions).toEqual(["mdx", "md"]);
    });
  });

  describe("extract — frontmatter", () => {
    it("parses YAML frontmatter in .md files", () => {
      const source = `---
title: Hello World
category: general
---

Body content here.`;
      const result = mdxAdapter.extract(source, "hello.md");
      expect(result.meta).toEqual({
        title: "Hello World",
        category: "general",
      });
      expect(result.body).toBe("Body content here.");
    });

    it("parses YAML frontmatter in .mdx files", () => {
      const source = `---
title: MDX with frontmatter
tags: ["a", "b"]
---

<Component />`;
      const result = mdxAdapter.extract(source, "page.mdx");
      expect(result.meta).toEqual({
        title: "MDX with frontmatter",
        tags: ["a", "b"],
      });
      expect(result.body).toBe("<Component />");
    });

    it("parses JSON frontmatter", () => {
      const source = `---
{"title": "JSON front", "count": 42}
---

Body.`;
      const result = mdxAdapter.extract(source, "test.md");
      expect(result.meta).toEqual({ title: "JSON front", count: 42 });
      expect(result.body).toBe("Body.");
    });

    it("parses boolean and null values in YAML", () => {
      const source = `---
published: true
draft: false
deleted: null
---

Content.`;
      const result = mdxAdapter.extract(source, "test.md");
      expect(result.meta).toEqual({
        published: true,
        draft: false,
        deleted: null,
      });
    });

    it("parses numeric values in YAML", () => {
      const source = `---
order: 5
weight: 3.14
---

Content.`;
      const result = mdxAdapter.extract(source, "test.md");
      expect(result.meta).toEqual({ order: 5, weight: 3.14 });
    });

    it("handles frontmatter with no body", () => {
      const source = `---
title: No body
---`;
      const result = mdxAdapter.extract(source, "test.md");
      expect(result.meta).toEqual({ title: "No body" });
      expect(result.body).toBe("");
    });

    it("handles leading whitespace before frontmatter", () => {
      const source = `  ---
title: Indented
---

Body.`;
      const result = mdxAdapter.extract(source, "test.md");
      expect(result.meta).toEqual({ title: "Indented" });
    });

    it("parses multiline JSON-ish arrays with trailing commas", () => {
      const source = `---
title: "Sewing Operator Jobs: Pay, Skills & Factory Career"
salaryTeasers:
  [
    {
      "range": "5,300–9,700",
      "currency": "CNY",
      "period": "monthly",
      "label": { "en": "China hubs", "zh": "中国枢纽" },
    },
  ]
keywords:
  [
    "sewing operator",
    "textile jobs",
    "factory jobs",
  ]
relatedCareers: ["quality-inspector", "production-manager"]
featured: false
publishedAt: "2026-05-08"
---

## What This Job Is
`;
      const result = mdxAdapter.extract(source, "sewing-operator.en.mdx");
      expect(result.meta.title).toBe(
        "Sewing Operator Jobs: Pay, Skills & Factory Career"
      );
      expect(result.meta.featured).toBe(false);
      expect(result.meta.publishedAt).toBe("2026-05-08");
      expect(result.meta.relatedCareers).toEqual([
        "quality-inspector",
        "production-manager",
      ]);
      expect(result.meta.keywords).toEqual([
        "sewing operator",
        "textile jobs",
        "factory jobs",
      ]);
      expect(result.meta.salaryTeasers).toEqual([
        {
          range: "5,300–9,700",
          currency: "CNY",
          period: "monthly",
          label: { en: "China hubs", zh: "中国枢纽" },
        },
      ]);
      expect(result.body).toContain("## What This Job Is");
    });

    it("parses YAML dash lists and indented maps", () => {
      const source = `---
keywords:
  - sewing operator
  - textile jobs
label:
  en: China hubs
  zh: 中国枢纽
people:
  - name: Ada
    role: operator
  - name: Lin
---

Body.`;
      const result = mdxAdapter.extract(source, "lists.md");
      expect(result.meta.keywords).toEqual(["sewing operator", "textile jobs"]);
      expect(result.meta.label).toEqual({ en: "China hubs", zh: "中国枢纽" });
      expect(result.meta.people).toEqual([
        { name: "Ada", role: "operator" },
        { name: "Lin" },
      ]);
    });

    it("parses JSON-ish flow objects with unquoted keys", () => {
      const source = `---
label: { en: "China hubs", zh: "中国枢纽" }
---

Body.`;
      const result = mdxAdapter.extract(source, "flow.md");
      expect(result.meta.label).toEqual({ en: "China hubs", zh: "中国枢纽" });
    });

    it("parses block scalars", () => {
      const source = `---
literal: |
  line one
  line two
folded: >
  hello
  world
---

Body.`;
      const result = mdxAdapter.extract(source, "scalar.md");
      expect(result.meta.literal).toBe("line one\nline two");
      expect(result.meta.folded).toBe("hello world");
    });

    it("keeps dates, URLs, and comma-grouped numbers as strings", () => {
      const source = `---
publishedAt: 2026-05-08
site: https://texhire.com/careers
range: 5,300
draft: false # not live
---

Body.`;
      const result = mdxAdapter.extract(source, "scalars.md");
      expect(result.meta.publishedAt).toBe("2026-05-08");
      expect(result.meta.site).toBe("https://texhire.com/careers");
      expect(result.meta.range).toBe("5,300");
      expect(result.meta.draft).toBe(false);
    });

    it("parses multiline JSON frontmatter documents", () => {
      const source = `---
{
  "title": "JSON front",
  "count": 42
}
---

Body.`;
      const result = mdxAdapter.extract(source, "json.md");
      expect(result.meta).toEqual({ title: "JSON front", count: 42 });
    });
  });

  describe("extract — export const meta", () => {
    it("parses export const meta in .mdx files", () => {
      const source = `export const meta = {
  title: "Hello",
  category: "products",
};

Body content here.`;
      const result = mdxAdapter.extract(source, "hello.mdx");
      expect(result.meta).toEqual({ title: "Hello", category: "products" });
      expect(result.body).toBe("Body content here.");
    });

    it("handles nested objects in export const meta", () => {
      const source = `export const meta = {
  title: "Nested",
  seo: { description: "A page", keywords: ["a", "b"] },
};

Body.`;
      const result = mdxAdapter.extract(source, "test.mdx");
      expect(result.meta.title).toBe("Nested");
      expect(result.meta.seo).toEqual({
        description: "A page",
        keywords: ["a", "b"],
      });
    });

    it("handles strings with special characters", () => {
      const source = `export const meta = {
  title: "What's the {best} approach?",
  note: 'Single "quoted"',
};

Body.`;
      const result = mdxAdapter.extract(source, "test.mdx");
      expect(result.meta.title).toBe("What's the {best} approach?");
      expect(result.meta.note).toBe('Single "quoted"');
    });

    it("returns empty meta when no meta block found", () => {
      const source = "Just some content without any meta block.";
      const result = mdxAdapter.extract(source, "test.mdx");
      expect(result.meta).toEqual({});
      expect(result.body).toBe("Just some content without any meta block.");
    });
  });

  describe("extract — priority", () => {
    it("frontmatter wins when both frontmatter and export const meta are present", () => {
      const source = `---
title: From frontmatter
---

export const meta = {
  title: "From export",
};

Body.`;
      const result = mdxAdapter.extract(source, "both.mdx");
      expect(result.meta.title).toBe("From frontmatter");
    });
  });

  describe("serialize", () => {
    it("serializes to export const meta format", () => {
      const meta = { title: "Hello", category: "products" };
      const body = "Body content.";
      const result = mdxAdapter.serialize(meta, body);
      expect(result).toContain("export const meta = ");
      expect(result).toContain('"title": "Hello"');
      expect(result).toContain("Body content.");
    });

    it("serializes without body", () => {
      const meta = { title: "No body" };
      const result = mdxAdapter.serialize(meta);
      expect(result).toContain("export const meta = ");
      expect(result).toContain('"title": "No body"');
    });

    it("roundtrip: serialize then extract recovers meta", () => {
      const original = { title: "Test", count: 42, tags: ["a", "b"] };
      const serialized = mdxAdapter.serialize(original, "My body.");
      const { meta, body } = mdxAdapter.extract(serialized, "test.mdx");
      expect(meta).toEqual(original);
      expect(body).toBe("My body.");
    });
  });
});
