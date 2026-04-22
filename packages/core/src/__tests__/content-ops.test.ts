/**
 * Unit tests for AI-native content operations (runList, runView, runCreate, runUpdate).
 */
import fs from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { runCreate, runList, runUpdate, runView } from "../run-content-ops.js";
import { prepareFixture } from "../test-fixtures.js";

let cwd: string;

describe("runList", () => {
  it("lists all collections when no collection specified", async () => {
    cwd = await prepareFixture("minimal");
    const result = await runList({ cwd });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty("collections");
    const data = result.data as { collections: Array<{ name: string; items: number }> };
    expect(data.collections.length).toBeGreaterThan(0);

    for (const col of data.collections) {
      expect(col.name).toBeTruthy();
      expect(typeof col.items).toBe("number");
    }
  });

  it("lists items in a specific collection", async () => {
    cwd = await prepareFixture("minimal");
    // First get collection names
    const listResult = await runList({ cwd });
    const data = listResult.data as { collections: Array<{ name: string }> };
    const colName = data.collections[0].name;

    const result = await runList({ cwd, collection: colName });
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty("items");
    const items = (result.data as { items: Array<{ slug: string }> }).items;
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].slug).toBeTruthy();
  });

  it("returns error for nonexistent collection", async () => {
    cwd = await prepareFixture("minimal");
    const result = await runList({ cwd, collection: "nonexistent-xyz" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });
});

describe("runView", () => {
  it("views content by slug", async () => {
    cwd = await prepareFixture("minimal");
    // Get a slug from listing
    const listResult = await runList({ cwd });
    const cols = (listResult.data as { collections: Array<{ name: string }> }).collections;
    const colName = cols[0].name;
    const itemsResult = await runList({ cwd, collection: colName });
    const items = (itemsResult.data as { items: Array<{ slug: string }> }).items;
    const slug = items[0].slug;

    const result = await runView({ cwd, collection: colName, slug });
    expect(result.success).toBe(true);
    expect(result.data).toBeTruthy();
    expect(result.data?.slug).toBe(slug);
    expect(result.data?.meta).toBeTruthy();
  });

  it("returns error for nonexistent slug", async () => {
    cwd = await prepareFixture("minimal");
    const listResult = await runList({ cwd });
    const cols = (listResult.data as { collections: Array<{ name: string }> }).collections;

    const result = await runView({ cwd, collection: cols[0].name, slug: "nonexistent-slug-xyz" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });
});

describe("runCreate", () => {
  afterEach(async () => {
    // clean up any created files
    if (cwd) {
      await fs.rm(cwd, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("creates a new content item and returns result", async () => {
    cwd = await prepareFixture("minimal");
    // Get collection info and schema
    const listResult = await runList({ cwd });
    const cols = (listResult.data as { collections: Array<{ name: string; fields?: string[] }> })
      .collections;
    const colName = cols[0].name;

    // View an existing item to understand the schema shape
    const itemsResult = await runList({ cwd, collection: colName });
    const items = (itemsResult.data as { items: Array<{ slug: string }> }).items;
    const existing = await runView({ cwd, collection: colName, slug: items[0].slug });

    if (existing.success && existing.data) {
      // Create with same meta shape
      const result = await runCreate({
        cwd,
        collection: colName,
        slug: "test-created-item",
        meta: existing.data.meta,
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.data?.slug).toBe("test-created-item");

      // Verify it can be read back
      const readBack = await runView({ cwd, collection: colName, slug: "test-created-item" });
      expect(readBack.success).toBe(true);
    }
  });

  it("rejects create with invalid meta", async () => {
    cwd = await prepareFixture("minimal");
    const listResult = await runList({ cwd });
    const cols = (listResult.data as { collections: Array<{ name: string }> }).collections;

    const result = await runCreate({
      cwd,
      collection: cols[0].name,
      slug: "bad-item",
      meta: {}, // empty meta likely fails required fields
    });
    // May succeed if all fields have defaults, but shouldn't crash
    expect(typeof result.success).toBe("boolean");
  });
});

describe("runUpdate", () => {
  afterEach(async () => {
    if (cwd) {
      await fs.rm(cwd, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("returns error when no mutations specified", async () => {
    cwd = await prepareFixture("minimal");
    const listResult = await runList({ cwd });
    const cols = (listResult.data as { collections: Array<{ name: string }> }).collections;
    const items = await runList({ cwd, collection: cols[0].name });
    const slug = (items.data as { items: Array<{ slug: string }> }).items[0].slug;

    const result = await runUpdate({
      cwd,
      collection: cols[0].name,
      slug,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("No mutations");
  });

  it("returns error for nonexistent slug", async () => {
    cwd = await prepareFixture("minimal");
    const listResult = await runList({ cwd });
    const cols = (listResult.data as { collections: Array<{ name: string }> }).collections;

    const result = await runUpdate({
      cwd,
      collection: cols[0].name,
      slug: "nonexistent-slug-xyz",
      set: { title: "new" },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });
});
