/**
 * Unit tests for the pure search module (`@contenz/core/search`).
 * Filesystem persistence is covered in search-index.test.ts.
 */
import { describe, expect, it } from "vitest";

import {
  addDocumentsToIndex,
  buildSearchDocument,
  collectMetaFieldNames,
  createSearchIndex,
  persistIndexToJson,
  querySearchIndex,
  restoreIndexFromJson,
} from "./search.js";

function sampleDocs() {
  return [
    buildSearchDocument(
      "faq",
      "moq",
      "en",
      "moq.en.json",
      { question: "What is the minimum order quantity?", category: "ordering" },
      "Minimum order quantity body"
    ),
    buildSearchDocument(
      "faq",
      "shipping",
      "en",
      "shipping.en.json",
      { question: "How fast is shipping?", category: "ordering" },
      "Shipping speed body"
    ),
  ];
}

describe("pure search operations", () => {
  it("queries an in-memory index", async () => {
    const index = await createSearchIndex(["question", "category"]);
    await addDocumentsToIndex(index, sampleDocs());

    const hits = await querySearchIndex(index, {
      query: "minimum order",
      collection: "faq",
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]).toMatchObject({ slug: "moq", locale: "en" });
    expect(hits[0].meta).toMatchObject({
      question: "What is the minimum order quantity?",
    });
  });

  it("round-trips through JSON persist/restore (the edge path)", async () => {
    const index = await createSearchIndex(["question", "category"]);
    await addDocumentsToIndex(index, sampleDocs());

    // Build side: serialize with no filesystem involved.
    const json = await persistIndexToJson(index);
    expect(typeof json).toBe("string");
    expect(json.length).toBeGreaterThan(0);

    // Edge side: restore from fetched bytes and query.
    const restored = await restoreIndexFromJson(json);
    const hits = await querySearchIndex(restored, {
      query: "shipping speed",
      collection: "faq",
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]).toMatchObject({ slug: "shipping" });
  });

  it("collects string meta field names", async () => {
    expect(collectMetaFieldNames(sampleDocs())).toEqual([
      "category",
      "question",
    ]);
  });

  it("excerpts bodies by default and honors overrides", () => {
    const long = "x".repeat(5000);
    const meta = { title: "t" };
    expect(
      buildSearchDocument("c", "s", undefined, "s.md", meta, long).body
    ).toHaveLength(2000);
    expect(
      buildSearchDocument("c", "s", undefined, "s.md", meta, long, 100).body
    ).toHaveLength(100);
    expect(
      buildSearchDocument("c", "s", undefined, "s.md", meta, long, null).body
    ).toHaveLength(5000);
    expect(
      buildSearchDocument("c", "s", undefined, "s.md", meta, long, 0).body
    ).toBe("");
    expect(
      buildSearchDocument("c", "s", undefined, "s.md", meta, undefined).body
    ).toBe("");
  });
});
