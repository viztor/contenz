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
			expect(result.meta).toEqual({ title: "Hello World", category: "general" });
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
