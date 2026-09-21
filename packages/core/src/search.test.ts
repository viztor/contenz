/**
 * Unit tests for the pure search module (`@contenz/core/search`).
 * Filesystem persistence is covered in search-index.test.ts.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addDocumentsToIndex,
  buildSearchDocument,
  collectMetaFieldNames,
  createSearchIndex,
  createSearchRouteHandler,
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

describe("createSearchRouteHandler", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function indexJson(): Promise<string> {
    const index = await createSearchIndex(["question", "category"]);
    await addDocumentsToIndex(index, sampleDocs());
    return persistIndexToJson(index);
  }

  it("serves a pre-restored index with cache headers", async () => {
    const handler = createSearchRouteHandler({
      index: await restoreIndexFromJson(await indexJson()),
    });
    const res = await handler(
      new Request("https://x.example/api/search?q=minimum")
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("cache-control")).toContain("s-maxage=60");
    const body = (await res.json()) as {
      query: string;
      total: number;
      hits: { slug: string; meta: Record<string, unknown> }[];
    };
    expect(body.query).toBe("minimum");
    expect(body.total).toBeGreaterThan(0);
    expect(body.hits[0].slug).toBe("moq");
  });

  it("fetches and caches the index per handler (isolate semantics)", async () => {
    const json = await indexJson();
    const fetchMock = vi.fn(async () => new Response(json));
    vi.stubGlobal("fetch", fetchMock);
    const handler = createSearchRouteHandler({
      indexUrl: "https://cdn.example.com/search-index.json",
    });
    const first = await handler(new Request("https://x.example/s?q=shipping"));
    const second = await handler(new Request("https://x.example/s?q=minimum"));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = (await second.json()) as { hits: { slug: string }[] };
    expect(body.hits[0].slug).toBe("moq");
  });

  it("rejects bad requests and unavailable indexes", async () => {
    const handler = createSearchRouteHandler({
      index: await restoreIndexFromJson(await indexJson()),
    });
    expect((await handler(new Request("https://x.example/s"))).status).toBe(
      400
    );
    expect(
      (
        await handler(
          new Request("https://x.example/s?q=x", { method: "POST" })
        )
      ).status
    ).toBe(405);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 404 }))
    );
    const missing = createSearchRouteHandler({
      indexUrl: "https://cdn.example.com/missing.json",
    });
    const res = await missing(new Request("https://x.example/s?q=x"));
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: string }).error).toContain(
      "unavailable"
    );
  });

  it("clamps limits and locks collections", async () => {
    const handler = createSearchRouteHandler({
      index: await restoreIndexFromJson(await indexJson()),
      collection: "faq",
    });
    const limited = (await (
      await handler(new Request("https://x.example/s?q=a&limit=1"))
    ).json()) as { total: number };
    expect(limited.total).toBeLessThanOrEqual(1);
    // A conflicting collection param loses to the lock (still 200 from faq).
    const locked = await handler(
      new Request("https://x.example/s?q=minimum&collection=other")
    );
    expect(locked.status).toBe(200);
    const body = (await locked.json()) as { collection: string };
    expect(body.collection).toBe("faq");
  });

  it("requires an index source at construction", () => {
    expect(() => createSearchRouteHandler({})).toThrow(
      "requires `index` or `indexUrl`"
    );
  });
});
