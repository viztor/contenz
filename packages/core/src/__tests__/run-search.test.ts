/**
 * Unit tests for runSearch: brute-force and indexed paths.
 */
import { describe, expect, it } from "vitest";
import { runSearch } from "../run-search.js";
import { prepareFixture } from "../test-fixtures.js";

describe("runSearch", () => {
  it("searches content by slug substring (brute-force)", async () => {
    const cwd = await prepareFixture("minimal");
    // List collections first to find a valid one
    const { runList } = await import("../run-content-ops.js");
    const listResult = await runList({ cwd });
    const cols = (listResult.data as { collections: Array<{ name: string }> }).collections;

    // Get items in first collection
    const itemsResult = await runList({ cwd, collection: cols[0].name });
    const items = (itemsResult.data as { items: Array<{ slug: string }> }).items;

    if (items.length > 0) {
      // Search for a partial slug
      const partialSlug = items[0].slug.slice(0, 3);
      const result = await runSearch({
        cwd,
        collection: cols[0].name,
        query: partialSlug,
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.data?.collection).toBe(cols[0].name);
      expect(result.data?.items.length).toBeGreaterThan(0);
    }
  });

  it("returns empty results for non-matching query", async () => {
    const cwd = await prepareFixture("minimal");
    const { runList } = await import("../run-content-ops.js");
    const listResult = await runList({ cwd });
    const cols = (listResult.data as { collections: Array<{ name: string }> }).collections;

    const result = await runSearch({
      cwd,
      collection: cols[0].name,
      query: "zzzznonexistentzzzz",
    });
    expect(result.success).toBe(true);
    expect(result.data?.items).toEqual([]);
  });

  it("returns error for nonexistent collection", async () => {
    const cwd = await prepareFixture("minimal");
    const result = await runSearch({
      cwd,
      collection: "nonexistent-collection-xyz",
      query: "test",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("respects limit parameter", async () => {
    const cwd = await prepareFixture("minimal");
    const { runList } = await import("../run-content-ops.js");
    const listResult = await runList({ cwd });
    const cols = (listResult.data as { collections: Array<{ name: string }> }).collections;

    // Search with limit 1
    const result = await runSearch({
      cwd,
      collection: cols[0].name,
      limit: 1,
    });
    expect(result.success).toBe(true);
    // Should return at most 1 item (may return 0 if brute-force with no query)
    expect(result.data?.items.length).toBeLessThanOrEqual(1);
  });

  it("searches i18n collection", async () => {
    const cwd = await prepareFixture("i18n");
    const { runList } = await import("../run-content-ops.js");
    const listResult = await runList({ cwd });
    const cols = (listResult.data as { collections: Array<{ name: string }> }).collections;
    const i18nCol = cols[0]; // i18n fixture has at least one collection

    const itemsResult = await runList({ cwd, collection: i18nCol.name });
    const items = (itemsResult.data as { items: Array<{ slug: string }> }).items;

    if (items.length > 0) {
      const result = await runSearch({
        cwd,
        collection: i18nCol.name,
        query: items[0].slug.slice(0, 3),
      });
      expect(result.success).toBe(true);
    }
  });
});
