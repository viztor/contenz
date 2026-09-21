import { describe, expect, it } from "vitest";
import { z } from "zod";

import { memoryStorage } from "./storage.js";
import { createWriter, ValidationFailedError } from "./writer.js";

const faqSchema = z.object({
  question: z.string(),
  category: z.string().default("general"),
});

const i18n = {
  enabled: true,
  defaultLocale: "en",
  locales: ["en", "zh", "zh-TW"],
  fallback: { "zh-TW": ["zh", "en"], zh: "en" },
} as const;

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
    "data/site.en.json": JSON.stringify({ title: "Example" }),
  });
}

function makeWriter(store = faqStore()) {
  return createWriter(
    {
      collections: [
        {
          name: "faq",
          dir: "content/faq",
          schema: faqSchema,
          extensions: ["json"],
        },
      ],
      singles: [{ name: "site", path: "data/site.en.json" }],
      i18n,
    },
    store
  );
}

describe("writer.planCreate", () => {
  it("builds a valid plan with filled defaults", async () => {
    const writer = makeWriter();
    const plan = await writer.planCreate("faq", "hello", {
      question: "Hello?",
    });
    expect(plan.kind).toBe("create");
    expect(plan.file).toBe("content/faq/hello.en.json");
    expect(plan.before).toBeNull();
    expect(plan.exists).toBe(false);
    expect(plan.valid).toBe(true);
    expect(plan.meta).toMatchObject({
      question: "Hello?",
      category: "general",
    });
    expect(new TextDecoder().decode(plan.after)).toContain("Hello?");
  });

  it("flags existing files without failing", async () => {
    const writer = makeWriter();
    const plan = await writer.planCreate("faq", "moq", {
      question: "Q?",
    });
    expect(plan.exists).toBe(true);
    expect(plan.valid).toBe(true);
  });

  it("returns invalid plans (not throws) for bad data", async () => {
    const writer = makeWriter();
    const plan = await writer.planCreate("faq", "bad", { category: "x" });
    expect(plan.valid).toBe(false);
    expect(plan.diagnostics.length).toBeGreaterThan(0);
    expect(plan.diagnostics[0]).toMatchObject({ field: expect.any(String) });
  });

  it("throws for unknown collections, singles, and unsafe slugs", async () => {
    const writer = makeWriter();
    await expect(
      writer.planCreate("nope", "x", { question: "Q?" })
    ).rejects.toThrow("Collection not found: nope");
    await expect(
      writer.planCreate("site", "site", { title: "x" })
    ).rejects.toThrow('Cannot create entries in single "site"');
    await expect(
      writer.planCreate("faq", "../escape", { question: "Q?" })
    ).rejects.toThrow('Invalid slug: "../escape"');
  });

  it("requires a locale when i18n is enabled without default", async () => {
    const store = faqStore();
    const writer = createWriter(
      {
        collections: [
          { name: "faq", dir: "content/faq", extensions: ["json"] },
        ],
        i18n: { enabled: true },
      },
      store
    );
    await expect(writer.planCreate("faq", "x", {})).rejects.toThrow(
      "Locale is required when i18n is enabled"
    );
    const plan = await writer.planCreate("faq", "x", {}, { locale: "zh" });
    expect(plan.file).toBe("content/faq/x.zh.json");
  });
});

describe("writer.planUpdate", () => {
  it("merges mutations preserving body and format", async () => {
    const store = memoryStorage({
      "content/faq/moq.en.json": JSON.stringify({
        question: "Old?",
        category: "ordering",
      }),
    });
    const writer = makeWriter(store);
    const plan = await writer.planUpdate(
      "faq",
      "moq",
      { set: { question: "New?" }, unset: ["category"] },
      "en"
    );
    expect(plan.kind).toBe("update");
    expect(plan.valid).toBe(true);
    expect(plan.meta).toMatchObject({ question: "New?" });
    expect(plan.meta).not.toHaveProperty("category");
    expect(plan.before).not.toBeNull();
  });

  it("never edits through a fallback hit", async () => {
    const writer = makeWriter();
    // moq.zh exists and zh falls back to en — but updates are exact-locale.
    // fr has no file and no chain: must miss, not resolve elsewhere.
    await expect(
      writer.planUpdate("faq", "moq", { set: { question: "X" } }, "fr")
    ).rejects.toThrow("Content not found: faq/moq");
  });

  it("throws on missing files, empty mutations, and wrong single slugs", async () => {
    const writer = makeWriter();
    await expect(
      writer.planUpdate("faq", "ghost", { set: { a: 1 } }, "en")
    ).rejects.toThrow("Content not found: faq/ghost");
    await expect(writer.planUpdate("faq", "moq", {}, "en")).rejects.toThrow(
      "No mutations specified"
    );
    await expect(
      writer.planUpdate("nope", "x", { set: { a: 1 } })
    ).rejects.toThrow("Content not found: nope/x");
    await expect(
      writer.planUpdate("site", "other", { set: { a: 1 } })
    ).rejects.toThrow("Content not found: site/other");
  });

  it("updates singles without a slug", async () => {
    const writer = makeWriter();
    const plan = await writer.planUpdate(
      "site",
      undefined,
      { set: { title: "Renamed" } },
      "en"
    );
    expect(plan.slug).toBe("site");
    expect(plan.file).toBe("data/site.en.json");
    expect(plan.meta).toMatchObject({ title: "Renamed" });
  });

  it("matches custom slugPattern layouts via listing fallback", async () => {
    // Files whose names only resolve through a custom pattern: probing the
    // conventional name misses, enumeration must find them.
    const store = memoryStorage({
      "content/docs/getting-started--guide_v2.json": JSON.stringify({
        title: "Guide",
      }),
    });
    const writer = createWriter(
      {
        collections: [
          {
            name: "docs",
            dir: "content/docs",
            extensions: ["json"],
            slugPattern: /^(.+)--(.+)\.(json)$/,
            validate: false,
          },
        ],
      },
      store
    );
    const plan = await writer.planUpdate("docs", "getting-started", {
      set: { title: "Updated" },
    });
    expect(plan.file).toBe("content/docs/getting-started--guide_v2.json");
    expect(plan.meta).toMatchObject({ title: "Updated" });
    const receipt = await writer.apply(plan);
    expect(receipt.file).toBe(plan.file);
  });
});

describe("writer.apply/create/update", () => {
  it("apply writes bytes and returns a receipt", async () => {
    const store = faqStore();
    const writer = makeWriter(store);
    const plan = await writer.planCreate("faq", "hello", {
      question: "Hello?",
    });
    const receipt = await writer.apply(plan);
    expect(receipt).toMatchObject({
      slug: "hello",
      collection: "faq",
      file: "content/faq/hello.en.json",
    });
    const bytes = await store.readFile("content/faq/hello.en.json");
    expect(JSON.parse(new TextDecoder().decode(bytes!))).toMatchObject({
      question: "Hello?",
      category: "general",
    });
  });

  it("apply refuses invalid plans with diagnostics attached", async () => {
    const writer = makeWriter();
    const plan = await writer.planCreate("faq", "bad", { category: "x" });
    const error: unknown = await writer.apply(plan).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationFailedError);
    if (!(error instanceof ValidationFailedError)) {
      throw new Error("expected ValidationFailedError");
    }
    expect(error.message).toBe("Validation failed");
    expect(error.diagnostics.length).toBeGreaterThan(0);
  });

  it("create/update conveniences round-trip", async () => {
    const store = faqStore();
    const writer = makeWriter(store);
    await writer.create("faq", "hello", { question: "Hello?" });
    const receipt = await writer.update(
      "faq",
      "hello",
      { set: { question: "Hi?" } },
      "en"
    );
    expect(receipt.meta).toMatchObject({ question: "Hi?" });
    await expect(
      writer.create("faq", "bad", { category: "x" })
    ).rejects.toThrow("Validation failed");
  });

  it("accepts an already-resolved i18n config", async () => {
    const store = faqStore();
    const { normalizeI18nConfig } = await import("./i18n.js");
    const writer = createWriter(
      {
        collections: [
          { name: "faq", dir: "content/faq", extensions: ["json"] },
        ],
        i18n: normalizeI18nConfig(i18n),
      },
      store
    );
    const entry = await writer.planUpdate(
      "faq",
      "moq",
      { set: { question: "Q?" } },
      "en"
    );
    expect(entry.valid).toBe(true);
  });
});
