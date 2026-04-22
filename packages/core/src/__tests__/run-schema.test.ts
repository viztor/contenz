/**
 * Unit tests for runSchema (schema introspection API).
 */
import { describe, expect, it } from "vitest";
import { runSchema } from "../run-schema.js";
import { prepareFixture } from "../test-fixtures.js";

describe("runSchema", () => {
  it("introspects schema for a valid collection", async () => {
    const cwd = await prepareFixture("minimal");
    // Get first collection name
    const { runList } = await import("../run-content-ops.js");
    const listResult = await runList({ cwd });
    const cols = (listResult.data as { collections: Array<{ name: string }> }).collections;

    const result = await runSchema({ cwd, collection: cols[0].name });
    expect(result.success).toBe(true);
    expect(result.data).toBeTruthy();
    expect(result.data?.collection).toBe(cols[0].name);
    expect(result.data?.schema).toBeTruthy();
    expect(result.data?.schema.fields).toBeTruthy();
    expect(Object.keys(result.data?.schema.fields).length).toBeGreaterThan(0);
  });

  it("returns error for nonexistent collection", async () => {
    const cwd = await prepareFixture("minimal");
    const result = await runSchema({ cwd, collection: "nonexistent-xyz" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("introspects a specific content type in multi-type collection", async () => {
    const cwd = await prepareFixture("multi-type");
    const result = await runSchema({ cwd, collection: "terms", contentType: "term" });
    expect(result.success).toBe(true);
    expect(result.data?.contentType).toBe("term");
  });

  it("returns error for nonexistent content type", async () => {
    const cwd = await prepareFixture("multi-type");
    const result = await runSchema({ cwd, collection: "terms", contentType: "nonexistent" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("returns relations when available", async () => {
    const cwd = await prepareFixture("minimal");
    const { runList } = await import("../run-content-ops.js");
    const listResult = await runList({ cwd });
    const cols = (listResult.data as { collections: Array<{ name: string }> }).collections;

    const result = await runSchema({ cwd, collection: cols[0].name });
    expect(result.success).toBe(true);
    // relations may be null if not defined
    expect(result.data?.relations === null || typeof result.data?.relations === "object").toBe(
      true
    );
  });
});
