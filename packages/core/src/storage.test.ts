import { describe, expect, it, vi, afterEach } from "vitest";

import {
  fetchStorage,
  isSafeStoragePath,
  joinStoragePath,
  memoryStorage,
  openFile,
  tieredStorage,
} from "./storage.js";

describe("joinStoragePath / isSafeStoragePath", () => {
  it("joins posix segments", () => {
    expect(joinStoragePath("content/faq", "a.en.mdx")).toBe(
      "content/faq/a.en.mdx"
    );
    expect(joinStoragePath("content/", "/faq/")).toBe("content/faq");
  });

  it("rejects traversal and absolutes", () => {
    expect(isSafeStoragePath("a/b.mdx")).toBe(true);
    expect(isSafeStoragePath("")).toBe(false);
    expect(isSafeStoragePath("../x")).toBe(false);
    expect(isSafeStoragePath("a/../b")).toBe(false);
    expect(isSafeStoragePath("a/./b")).toBe(false);
    expect(isSafeStoragePath("a\\b")).toBe(false);
  });
});

describe("memoryStorage", () => {
  const store = memoryStorage({
    "content/faq/a.en.mdx": "a",
    "content/faq/b.zh.mdx": "b",
    "content/faq/README.md": "readme",
    "content/faq/_drafts/wip.mdx": "wip",
    "content/blog/p.mdx": "p",
    "./content/dot.mdx": "dot",
  });

  it("reads files", async () => {
    const bytes = await store.readFile("content/faq/a.en.mdx");
    expect(new TextDecoder().decode(bytes!)).toBe("a");
  });

  it("returns null for missing and unsafe paths", async () => {
    expect(await store.readFile("content/nope.mdx")).toBeNull();
    expect(await store.readFile("../escape")).toBeNull();
  });

  it("lists immediate children only", async () => {
    expect(await store.listdir("content/faq")).toEqual([
      { name: "_drafts", kind: "dir" },
      { name: "a.en.mdx", kind: "file" },
      { name: "b.zh.mdx", kind: "file" },
      { name: "README.md", kind: "file" },
    ]);
    expect(await store.listdir("content/missing")).toEqual([]);
  });

  it("streams single-chunk bodies", async () => {
    const stream = await store.streamFile!("content/faq/a.en.mdx");
    const chunks: Uint8Array[] = [];
    const reader = stream!.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    expect(total).toBe(1);
    expect(await store.streamFile!("content/nope.mdx")).toBeNull();
  });
});

function stubFetch(
  impl: (url: string, init?: RequestInit) => Response | Promise<Response>
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => impl(url, init))
  );
  return fetch as unknown as ReturnType<typeof vi.fn>;
}

describe("fetchStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads bytes and maps 404 to null", async () => {
    const seen: string[] = [];
    stubFetch((url) => {
      seen.push(url);
      if (url.endsWith("missing.mdx"))
        return new Response("x", { status: 404 });
      return new Response("hello");
    });
    const store = fetchStorage({ baseUrl: "https://cdn.example.com/content/" });
    const bytes = await store.readFile("faq/a.mdx");
    expect(new TextDecoder().decode(bytes!)).toBe("hello");
    expect(seen[0]).toBe("https://cdn.example.com/content/faq/a.mdx");
    expect(await store.readFile("missing.mdx")).toBeNull();
  });

  it("throws on non-404 errors", async () => {
    stubFetch(() => new Response("boom", { status: 500 }));
    const store = fetchStorage({ baseUrl: "https://x.example" });
    await expect(store.readFile("a.mdx")).rejects.toThrow("500");
  });

  it("lists via .listing.json and throws LISTING_MISSING without it", async () => {
    stubFetch((url) => {
      if (url.endsWith(".listing.json"))
        return Response.json(["b.mdx", "a.mdx"]);
      return new Response("x", { status: 404 });
    });
    const store = fetchStorage({ baseUrl: "https://x.example" });
    expect(await store.listdir("faq")).toEqual([
      { name: "a.mdx", kind: "file" },
      { name: "b.mdx", kind: "file" },
    ]);

    stubFetch(() => new Response("x", { status: 404 }));
    const bare = fetchStorage({ baseUrl: "https://x.example" });
    await expect(bare.listdir("faq")).rejects.toThrow("LISTING_MISSING");
  });

  it("sends Range headers when streaming with range", async () => {
    let rangeHeader: string | null = null;
    stubFetch((_url, init) => {
      rangeHeader = new Headers(init?.headers).get("Range");
      return new Response("0123456789");
    });
    const store = fetchStorage({ baseUrl: "https://x.example" });
    await store.streamFile!("f.bin", { range: { offset: 2, length: 3 } });
    expect(rangeHeader).toBe("bytes=2-4");
  });
});

describe("tieredStorage", () => {
  it("prefers first hit and merges listings", async () => {
    const a = memoryStorage({ "d/x.mdx": "ax", "d/only-a.mdx": "a" });
    const b = memoryStorage({ "d/x.mdx": "bx", "d/only-b.mdx": "b" });
    const tiered = tieredStorage([a, b]);
    expect(new TextDecoder().decode((await tiered.readFile("d/x.mdx"))!)).toBe(
      "ax"
    );
    expect(
      new TextDecoder().decode((await tiered.readFile("d/only-b.mdx"))!)
    ).toBe("b");
    expect(await tiered.readFile("d/nope.mdx")).toBeNull();
    expect(await tiered.listdir("d")).toEqual([
      { name: "only-a.mdx", kind: "file" },
      { name: "only-b.mdx", kind: "file" },
      { name: "x.mdx", kind: "file" },
    ]);
  });

  it("delegates stat to the first backend that knows", async () => {
    const a = memoryStorage({ "d/x.mdx": "ax" });
    const b = memoryStorage({ "d/y.mdx": "by" });
    const tiered = tieredStorage([a, b]);
    expect(await tiered.stat!("d/x.mdx")).toMatchObject({ size: 2 });
    expect(await tiered.stat!("d/y.mdx")).toMatchObject({ size: 2 });
    expect(await tiered.stat!("d/nope.mdx")).toBeNull();
  });
});

describe("stat", () => {
  it("memory reports byte sizes", async () => {
    const store = memoryStorage({ "f.mdx": "héllo" });
    expect(await store.stat!("f.mdx")).toMatchObject({ size: 6 });
    expect(await store.stat!("missing")).toBeNull();
    expect(await store.stat!("../escape")).toBeNull();
  });

  it("fetch stats via HEAD", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if ((init?.method ?? "GET") === "HEAD") {
          if (String(url).endsWith("missing.mdx")) {
            return new Response("x", { status: 404 });
          }
          return new Response(null, {
            status: 200,
            headers: {
              "content-length": "42",
              "last-modified": "Thu, 01 Jan 2026 00:00:00 GMT",
              etag: '"abc"',
            },
          });
        }
        return new Response("x", { status: 404 });
      })
    );
    try {
      const store = fetchStorage({ baseUrl: "https://x.example" });
      expect(await store.stat!("f.mdx")).toMatchObject({
        size: 42,
        mtimeMs: Date.parse("Thu, 01 Jan 2026 00:00:00 GMT"),
        etag: '"abc"',
      });
      expect(await store.stat!("missing.mdx")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("openFile", () => {
  it("reads, ranges, decodes, and stats over memory", async () => {
    const store = memoryStorage({ "d/f.json": '{"a":1}extra' });
    const handle = await openFile(store, "d/f.json");
    expect(handle).not.toBeNull();
    expect(handle!.size).toBe(12);
    expect(handle!.seekable).toBe(true);
    expect(await handle!.stat()).toMatchObject({ size: 12 });
    expect(await handle!.text()).toBe('{"a":1}extra');
    expect(await handle!.read({ offset: 0, length: 7 })).toEqual(
      new TextEncoder().encode('{"a":1}')
    );
    expect(new TextDecoder().decode((await handle!.read())!)).toBe(
      '{"a":1}extra'
    );
  });

  it("parses JSON bodies", async () => {
    const store = memoryStorage({ "d/f.json": '{"a":1}' });
    const handle = await openFile(store, "d/f.json");
    expect(await handle!.json()).toEqual({ a: 1 });
    // Memory stat is authoritative: missing files yield no handle.
    expect(await openFile(store, "missing")).toBeNull();
  });

  it("rejects unsafe paths", async () => {
    const store = memoryStorage({ f: "x" });
    expect(await openFile(store, "../escape")).toBeNull();
    expect(await openFile(store, "")).toBeNull();
  });

  it("streams ranges over node fs without buffering wholes", async () => {
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");
    const { nodeStorage } = await import("./storage-node.js");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "contenz-openfile-"));
    try {
      await fs.writeFile(path.join(dir, "big.bin"), "0123456789abcdef");
      const store = nodeStorage({ root: dir });
      const handle = await openFile(store, "big.bin");
      expect(await handle!.stat()).toMatchObject({ size: 16 });
      expect(
        new TextDecoder().decode(
          (await handle!.read({ offset: 4, length: 4 }))!
        )
      ).toBe("4567");
      expect(await handle!.stat()).toMatchObject({
        mtimeMs: expect.any(Number),
      });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("maps fetch 416 to empty (not missing)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if ((init?.method ?? "GET") === "HEAD") {
          return new Response(null, {
            status: 200,
            headers: { "content-length": "10" },
          });
        }
        const range = new Headers(init?.headers).get("Range");
        if (range === "bytes=100-109") {
          return new Response("x", { status: 416 });
        }
        return new Response("0123456789");
      })
    );
    try {
      const store = fetchStorage({ baseUrl: "https://x.example" });
      const handle = await openFile(store, "f.bin");
      expect(handle!.size).toBe(10);
      const bytes = await handle!.read({ offset: 100, length: 10 });
      expect(bytes).not.toBeNull();
      expect(bytes!.length).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
