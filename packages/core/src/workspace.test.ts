/**
 * Unit tests for the workspace loader.
 */
import { describe, expect, it } from "vitest";
import { prepareFixture } from "./test-fixtures.js";
import { createWorkspace } from "./workspace.js";

describe("createWorkspace", () => {
  it("discovers collections from a valid flat project", async () => {
    const cwd = await prepareFixture("minimal");
    const ws = await createWorkspace({ cwd });

    expect(ws.cwd).toBe(cwd);
    expect(ws.collections.length).toBeGreaterThan(0);
    expect(ws.discoveryErrors).toEqual([]);

    // Every collection has contentFiles and config
    for (const col of ws.collections) {
      expect(col.name).toBeTruthy();
      expect(col.collectionPath).toBeTruthy();
      expect(col.config).toBeTruthy();
      expect(Array.isArray(col.contentFiles)).toBe(true);
    }
  });

  it("getCollection returns the correct collection", async () => {
    const cwd = await prepareFixture("minimal");
    const ws = await createWorkspace({ cwd });

    const first = ws.collections[0];
    expect(ws.getCollection(first.name)).toBe(first);
  });

  it("getCollection returns undefined for nonexistent name", async () => {
    const cwd = await prepareFixture("minimal");
    const ws = await createWorkspace({ cwd });

    expect(ws.getCollection("nonexistent-collection-xyz")).toBeUndefined();
  });

  it("filters to a single collection when specified", async () => {
    const cwd = await prepareFixture("minimal");
    const ws = await createWorkspace({ cwd });
    const targetName = ws.collections[0].name;

    const filtered = await createWorkspace({ cwd, collection: targetName });
    expect(filtered.collections).toHaveLength(1);
    expect(filtered.collections[0].name).toBe(targetName);
  });

  it("loads schema module for collections that have one", async () => {
    const cwd = await prepareFixture("minimal");
    const ws = await createWorkspace({ cwd });

    const withSchema = ws.collections.find((c) => c.schema?.meta);
    if (withSchema) {
      expect(withSchema.schema).toBeTruthy();
      expect(withSchema.schema?.meta).toBeTruthy();
    }
  });

  it("discovers collections from i18n fixture", async () => {
    const cwd = await prepareFixture("i18n");
    const ws = await createWorkspace({ cwd });

    expect(ws.collections.length).toBeGreaterThan(0);
    const i18nCol = ws.collections.find((c) => c.config.i18n);
    expect(i18nCol).toBeTruthy();
  });

  it("discovers collections from mixed-sources fixture", async () => {
    const cwd = await prepareFixture("mixed-sources");
    const ws = await createWorkspace({ cwd });

    expect(ws.collections.length).toBeGreaterThanOrEqual(2);
    const names = ws.collections.map((c) => c.name);
    expect(names).toContain("docs");
  });

  it("collections are sorted alphabetically", async () => {
    const cwd = await prepareFixture("mixed-sources");
    const ws = await createWorkspace({ cwd });

    const names = ws.collections.map((c) => c.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });
});
