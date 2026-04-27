/**
 * Unit tests for the MiniSearch-based search index.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  addDocumentsToIndex,
  buildSearchDocument,
  collectMetaFieldNames,
  createSearchIndex,
  discardDocuments,
  loadSearchIndex,
  querySearchIndex,
  saveSearchIndex,
} from "./search-index.js";

let tempDir: string;

afterEach(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

describe("buildSearchDocument", () => {
  it("builds a document with correct id format", () => {
    const doc = buildSearchDocument("faq", "moq", "en", "moq.en.mdx", { title: "MOQ" }, "body");
    expect(doc.id).toBe("faq:moq:en");
    expect(doc.collection).toBe("faq");
    expect(doc.slug).toBe("moq");
    expect(doc.locale).toBe("en");
    expect(doc.file).toBe("moq.en.mdx");
    expect(doc.body).toBe("body");
    expect(doc.title).toBe("MOQ"); // spread string field
  });

  it("uses _ for locale when undefined", () => {
    const doc = buildSearchDocument("faq", "moq", undefined, "moq.mdx", {}, undefined);
    expect(doc.id).toBe("faq:moq:_");
    expect(doc.locale).toBe("_");
    expect(doc.body).toBe("");
  });

  it("joins string arrays for indexing", () => {
    const doc = buildSearchDocument(
      "faq",
      "moq",
      "en",
      "moq.en.mdx",
      {
        tags: ["a", "b", "c"],
      },
      ""
    );
    expect(doc.tags).toBe("a b c");
  });

  it("does not spread non-string meta fields", () => {
    const doc = buildSearchDocument("faq", "moq", "en", "f", { count: 42, nested: { x: 1 } }, "");
    expect(doc.count).toBeUndefined();
    expect(doc.nested).toBeUndefined();
  });

  it("stores meta as JSON in _metaJson", () => {
    const meta = { title: "Hello", count: 5 };
    const doc = buildSearchDocument("faq", "moq", "en", "f", meta, "");
    expect(JSON.parse(doc._metaJson)).toEqual(meta);
  });
});

describe("createSearchIndex + add + query", () => {
  it("indexes documents and finds them by slug", () => {
    const index = createSearchIndex(["title"]);
    const doc = buildSearchDocument(
      "faq",
      "moq",
      "en",
      "moq.en.mdx",
      { title: "Minimum Order" },
      ""
    );
    addDocumentsToIndex(index, [doc]);

    const hits = querySearchIndex(index, { query: "moq" });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].slug).toBe("moq");
  });

  it("finds documents by meta field content", () => {
    const index = createSearchIndex(["title"]);
    addDocumentsToIndex(index, [
      buildSearchDocument("faq", "moq", "en", "f1", { title: "Minimum Order Quantity" }, ""),
      buildSearchDocument("faq", "lead", "en", "f2", { title: "Lead Time" }, ""),
    ]);

    const hits = querySearchIndex(index, { query: "minimum" });
    expect(hits.length).toBe(1);
    expect(hits[0].slug).toBe("moq");
  });

  it("filters by collection", () => {
    const index = createSearchIndex(["title"]);
    addDocumentsToIndex(index, [
      buildSearchDocument("faq", "moq", "en", "f1", { title: "MOQ" }, ""),
      buildSearchDocument("glossary", "moq", "en", "f2", { title: "MOQ term" }, ""),
    ]);

    const hits = querySearchIndex(index, { query: "moq", collection: "faq" });
    expect(hits.every((h) => h.meta.title !== "MOQ term")).toBe(true);
  });

  it("filters by locale", () => {
    const index = createSearchIndex(["title"]);
    addDocumentsToIndex(index, [
      buildSearchDocument("faq", "moq", "en", "f1", { title: "MOQ" }, ""),
      buildSearchDocument("faq", "moq", "zh", "f2", { title: "最小订购量" }, ""),
    ]);

    const hits = querySearchIndex(index, { query: "moq", locale: "en" });
    expect(hits.length).toBe(1);
    expect(hits[0].locale).toBe("en");
  });

  it("applies field filters", () => {
    const index = createSearchIndex(["title", "category"]);
    addDocumentsToIndex(index, [
      buildSearchDocument("faq", "moq", "en", "f1", { title: "MOQ", category: "products" }, ""),
      buildSearchDocument(
        "faq",
        "lead",
        "en",
        "f2",
        { title: "Lead Time", category: "shipping" },
        ""
      ),
    ]);

    const hits = querySearchIndex(index, { query: "moq lead", fields: { category: "products" } });
    expect(hits.every((h) => h.meta.category === "products")).toBe(true);
  });

  it("respects limit", () => {
    const index = createSearchIndex(["title"]);
    const docs = Array.from({ length: 20 }, (_, i) =>
      buildSearchDocument("faq", `item-${i}`, "en", `f${i}`, { title: `Item ${i}` }, "common text")
    );
    addDocumentsToIndex(index, docs);

    const hits = querySearchIndex(index, { query: "item", limit: 3 });
    expect(hits.length).toBeLessThanOrEqual(3);
  });

  it("returns empty when no query and no fields", () => {
    const index = createSearchIndex(["title"]);
    addDocumentsToIndex(index, [
      buildSearchDocument("faq", "moq", "en", "f1", { title: "MOQ" }, ""),
    ]);
    const hits = querySearchIndex(index, {});
    expect(hits).toEqual([]);
  });
});

describe("discardDocuments", () => {
  it("removes documents from the index", () => {
    const index = createSearchIndex(["title"]);
    const doc = buildSearchDocument("faq", "moq", "en", "f", { title: "MOQ" }, "");
    addDocumentsToIndex(index, [doc]);

    expect(querySearchIndex(index, { query: "moq" }).length).toBeGreaterThan(0);

    discardDocuments(index, ["faq:moq:en"]);
    expect(querySearchIndex(index, { query: "moq" })).toEqual([]);
  });

  it("silently ignores nonexistent IDs", () => {
    const index = createSearchIndex([]);
    expect(() => discardDocuments(index, ["nonexistent:id:_"])).not.toThrow();
  });
});

describe("collectMetaFieldNames", () => {
  it("collects string-valued meta field names", () => {
    const docs = [
      buildSearchDocument("faq", "a", "en", "f", { title: "T", category: "C", count: 5 }, ""),
      buildSearchDocument("faq", "b", "en", "f", { title: "T2", tags: ["x", "y"] }, ""),
    ];
    const names = collectMetaFieldNames(docs);
    expect(names).toContain("title");
    expect(names).toContain("category");
    expect(names).toContain("tags");
    expect(names).not.toContain("count"); // number, not string
  });

  it("returns sorted unique names", () => {
    const docs = [
      buildSearchDocument("a", "1", "en", "f", { z: "z", a: "a" }, ""),
      buildSearchDocument("a", "2", "en", "f", { a: "a2", m: "m" }, ""),
    ];
    const names = collectMetaFieldNames(docs);
    expect(names).toEqual(["a", "m", "z"]);
  });
});

describe("save and load search index", () => {
  it("round-trips an index through disk", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "contenz-search-"));
    const index = createSearchIndex(["title"]);
    addDocumentsToIndex(index, [
      buildSearchDocument("faq", "moq", "en", "f1", { title: "MOQ" }, "body"),
    ]);

    await saveSearchIndex(tempDir, index, ["title"]);
    const loaded = await loadSearchIndex(tempDir);
    expect(loaded).not.toBeNull();

    if (!loaded) throw new Error("Expected index to be loaded");

    const hits = querySearchIndex(loaded, { query: "moq" });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].slug).toBe("moq");
  });

  it("returns null when no index file exists", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "contenz-search-empty-"));
    const loaded = await loadSearchIndex(tempDir);
    expect(loaded).toBeNull();
  });
});
