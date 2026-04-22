/**
 * Unit tests for the format adapter registry and built-in JSON adapter.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  type FormatAdapter,
  getAdapterForExtension,
  jsonAdapter,
  registerAdapters,
} from "./format-adapter.js";

describe("jsonAdapter", () => {
  it("extracts meta from valid JSON", () => {
    const result = jsonAdapter.extract('{"title":"Hello","count":42}', "test.json");
    expect(result.meta).toEqual({ title: "Hello", count: 42 });
    expect(result.body).toBeUndefined();
  });

  it("returns empty meta for JSON arrays", () => {
    const result = jsonAdapter.extract("[1,2,3]", "test.json");
    expect(result.meta).toEqual({});
  });

  it("returns empty meta for invalid JSON", () => {
    const result = jsonAdapter.extract("not json at all", "test.json");
    expect(result.meta).toEqual({});
  });

  it("returns empty meta for null JSON", () => {
    const result = jsonAdapter.extract("null", "test.json");
    expect(result.meta).toEqual({});
  });

  it("serializes meta to pretty-printed JSON with trailing newline", () => {
    const output = jsonAdapter.serialize({ title: "Hello", count: 42 });
    expect(output).toBe('{\n  "title": "Hello",\n  "count": 42\n}\n');
  });

  it("ignores body parameter in serialize (JSON has no body)", () => {
    const output = jsonAdapter.serialize({ a: 1 }, "ignored body");
    expect(output).toBe('{\n  "a": 1\n}\n');
  });
});

describe("getAdapterForExtension", () => {
  it("returns jsonAdapter for .json extension", () => {
    expect(getAdapterForExtension("json")).toBe(jsonAdapter);
    expect(getAdapterForExtension(".json")).toBe(jsonAdapter);
  });

  it("returns null for unregistered extensions", () => {
    expect(getAdapterForExtension("yaml")).toBeNull();
    expect(getAdapterForExtension(".toml")).toBeNull();
  });
});

describe("registerAdapters", () => {
  // Store original state to restore after tests
  const yamlAdapter: FormatAdapter = {
    extensions: ["yaml", "yml"],
    extract(source: string) {
      return { meta: { raw: source.trim() } };
    },
    serialize(meta: Record<string, unknown>) {
      return `title: ${meta.title}\n`;
    },
  };

  afterEach(() => {
    // Clean up by re-registering json adapter to reset state
    // (registerAdapters removes duplicates before prepending)
    registerAdapters([jsonAdapter]);
  });

  it("registers a new adapter and makes it findable", () => {
    registerAdapters([yamlAdapter]);
    const found = getAdapterForExtension("yaml");
    expect(found).toBe(yamlAdapter);
    expect(getAdapterForExtension("yml")).toBe(yamlAdapter);
  });

  it("new adapter overrides existing adapter for same extension", () => {
    const customJsonAdapter: FormatAdapter = {
      extensions: ["json"],
      extract() {
        return { meta: { custom: true } };
      },
      serialize() {
        return "{}";
      },
    };
    registerAdapters([customJsonAdapter]);
    const found = getAdapterForExtension("json");
    expect(found).toBe(customJsonAdapter);
    expect(found).not.toBe(jsonAdapter);
  });
});
