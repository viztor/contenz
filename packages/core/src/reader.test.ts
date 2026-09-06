import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { FormatAdapter } from "./format-adapter.js";
import { createReader } from "./reader.js";
import { memoryStorage } from "./storage.js";

const faqSchema = z.object({
  question: z.string(),
  category: z.enum(["products", "ordering"]),
});

// Minimal stub adapter proving custom adapters flow through the reader.
const stubAdapter: FormatAdapter = {
  extensions: ["stub"],
  extract(source: string) {
    const [first, ...rest] = source.split("\n");
    return {
      meta: first.startsWith("Q: ")
        ? { question: first.slice(3), category: "products" }
        : {},
      body: rest.join("\n"),
    };
  },
  serialize(meta, body) {
    return `Q: ${String(meta.question ?? "")}\n${body ?? ""}`;
  },
};

function faqStore() {
  return memoryStorage({
    "content/faq/moq.en.json": JSON.stringify({
      question: "What is MOQ?",
      category: "ordering",
    }),
    "content/faq/moq.zh.json": JSON.stringify({
      question: "最低起订量是多少？",
      category: "ordering",
    }),
    "content/faq/hello.json": JSON.stringify({
      question: "Hello",
      category: "products",
    }),
    "content/faq/README.md": "ignore me",
    "content/faq/_draft.mdx": "ignore me",
    "content/faq/note.stub": "Q: Stubbed?\nbody here",
  });
}

describe("reader (non-i18n)", () => {
  const reader = createReader(
    {
      collections: [{ name: "faq", dir: "content/faq", schema: faqSchema }],
      adapters: [stubAdapter],
    },
    faqStore()
  );

  it("lists slugs, skipping ignored and unparsable files", async () => {
    // note.stub is skipped: .stub not in default extensions
    expect(await reader.collections.faq.list()).toEqual([
      "hello",
      "moq.en",
      "moq.zh",
    ]);
  });

  it("reads an entry with meta", async () => {
    const entry = await reader.collections.faq.read("hello");
    expect(entry).toMatchObject({
      slug: "hello",
      locale: null,
      file: "content/faq/hello.json",
      meta: { question: "Hello", category: "products" },
    });
  });

  it("returns null for missing entries and unsafe slugs", async () => {
    expect(await reader.collections.faq.read("nope")).toBeNull();
    expect(await reader.collections.faq.read("../escape")).toBeNull();
    expect(await reader.collections.faq.read("a/b")).toBeNull();
  });

  it("readOrThrow throws a named error", async () => {
    await expect(reader.collections.faq.readOrThrow("nope")).rejects.toThrow(
      'Entry "nope" not found in collection "faq"'
    );
  });

  it("throws for unknown collections", async () => {
    const r = createReader({ collections: [] }, faqStore());
    expect(() => r.collections.nope).toThrow("Collection not found: nope");
  });

  it("reads all entries", async () => {
    const all = await reader.collections.faq.all();
    expect(all.map((e) => e.slug).sort()).toEqual([
      "hello",
      "moq.en",
      "moq.zh",
    ]);
  });

  it("throws on invalid meta when a schema is present", async () => {
    const bad = createReader(
      {
        collections: [{ name: "faq", dir: "content/faq", schema: faqSchema }],
      },
      memoryStorage({
        "content/faq/bad.json": JSON.stringify({ question: 42 }),
      })
    );
    await expect(bad.collections.faq.read("bad")).rejects.toThrow(
      'Invalid meta in "content/faq/bad.json"'
    );
  });

  it("skips validation with validate: false", async () => {
    const lax = createReader(
      {
        collections: [
          {
            name: "faq",
            dir: "content/faq",
            schema: faqSchema,
            validate: false,
          },
        ],
      },
      memoryStorage({
        "content/faq/bad.json": JSON.stringify({ question: 42 }),
      })
    );
    const entry = await lax.collections.faq.read("bad");
    expect(entry?.meta).toEqual({ question: 42 });
  });

  it("uses custom adapters", async () => {
    const r = createReader(
      {
        collections: [
          {
            name: "faq",
            dir: "content/faq",
            extensions: ["stub"],
            validate: false,
          },
        ],
        adapters: [stubAdapter],
      },
      faqStore()
    );
    expect(await r.collections.faq.list()).toEqual(["note"]);
    const entry = await r.collections.faq.read("note");
    expect(entry?.meta).toEqual({
      question: "Stubbed?",
      category: "products",
    });
    expect(entry?.body).toBe("body here");
  });
});

describe("reader (i18n)", () => {
  const i18n = {
    enabled: true,
    defaultLocale: "en",
    locales: ["en", "zh", "zh-TW"],
    fallback: { "zh-TW": ["zh", "en"] },
    includeFallbackMetadata: true,
  } as const;

  const reader = createReader(
    { collections: [{ name: "faq", dir: "content/faq" }], i18n },
    faqStore()
  );

  it("lists deduplicated slugs (locale-less files are invisible in i18n mode)", async () => {
    expect(await reader.collections.faq.list()).toEqual(["moq"]);
  });

  it("reads the requested locale directly", async () => {
    const entry = await reader.collections.faq.read("moq", "zh");
    expect(entry?.meta).toMatchObject({ question: "最低起订量是多少？" });
    expect(entry?._fallback).toBeUndefined();
    expect(entry?.locale).toBe("zh");
  });

  it("defaults to the default locale", async () => {
    const entry = await reader.collections.faq.read("moq");
    expect(entry?.locale).toBe("en");
  });

  it("walks the fallback chain with provenance", async () => {
    const entry = await reader.collections.faq.read("moq", "zh-TW");
    expect(entry?.locale).toBe("zh");
    expect(entry?._fallback).toBe("zh");
  });

  it("omits _fallback when includeFallbackMetadata is false", async () => {
    const r = createReader(
      {
        collections: [{ name: "faq", dir: "content/faq" }],
        i18n: { ...i18n, includeFallbackMetadata: false },
      },
      faqStore()
    );
    const entry = await r.collections.faq.read("moq", "zh-TW");
    expect(entry?.locale).toBe("zh");
    expect(entry?._fallback).toBeUndefined();
  });

  it("returns null with fallback disabled", async () => {
    const entry = await reader.collections.faq.read("moq", {
      locale: "zh-TW",
      fallback: false,
    });
    expect(entry).toBeNull();
  });

  it("returns null when no locale and no default", async () => {
    const r = createReader(
      {
        collections: [{ name: "faq", dir: "content/faq" }],
        i18n: { enabled: true },
      },
      faqStore()
    );
    expect(await r.collections.faq.read("moq")).toBeNull();
  });

  it("all() resolves each slug with fallback", async () => {
    const all = await reader.collections.faq.all("zh-TW");
    expect(all.map((e) => [e.slug, e.locale])).toEqual([["moq", "zh"]]);
  });
});
