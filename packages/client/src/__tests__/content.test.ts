import { describe, expect, it } from "vitest";

import { createContent } from "../content.js";

const collections = {
  faq: {
    moq: {
      slug: "moq",
      locales: {
        en: { slug: "moq", file: "moq.en.json", question: "What is MOQ?" },
        zh: {
          slug: "moq",
          file: "moq.zh.json",
          question: "最低起订量是多少？",
        },
      },
    },
    hello: {
      slug: "hello",
      locales: {
        en: {
          slug: "hello",
          file: "hello.en.json",
          question: "How do I order?",
        },
      },
    },
  },
} as const;

describe("createContent", () => {
  it("resolves the requested locale directly", () => {
    const content = createContent({
      locale: "zh",
      defaultLocale: "en",
      collections,
    });

    const entry = content.collection("faq")?.get("moq");
    expect(entry?.question).toBe("最低起订量是多少？");
    expect(entry?._resolvedFrom).toBeUndefined();
  });

  it("falls back to defaultLocale when translation is missing", () => {
    const content = createContent({
      locale: "ja",
      defaultLocale: "en",
      collections,
    });

    const entry = content.collection("faq")?.get("hello");
    expect(entry?.question).toBe("How do I order?");
    expect(entry?._resolvedFrom).toBe("en");
  });

  it("follows configured fallback before defaultLocale", () => {
    const content = createContent({
      locale: "zh-Hant",
      defaultLocale: "en",
      fallback: { "zh-Hant": "zh" },
      collections,
    });

    const entry = content.collection("faq")?.get("moq");
    expect(entry?.question).toBe("最低起订量是多少？");
    expect(entry?._resolvedFrom).toBe("zh");
  });

  it("lists all entries with fallback applied per slug", () => {
    const content = createContent({
      locale: "ja",
      defaultLocale: "en",
      collections,
    });

    const all = content.collection("faq")?.all() ?? [];
    expect(all).toHaveLength(2);
    expect(all.find((e) => e.slug === "hello")?._resolvedFrom).toBe("en");
  });

  it("returns undefined for unknown collection", () => {
    const content = createContent({ locale: "en", collections });
    expect(content.collection("blog")).toBeUndefined();
  });

  it("exposes named collections as properties", () => {
    const content = createContent({
      locale: "zh",
      defaultLocale: "en",
      collections,
    });

    expect(content.faq.get("moq")?.question).toBe("最低起订量是多少？");
    expect(content.faq.name).toBe("faq");
    expect(content.faq.has("moq")).toBe(true);
    expect(content.collectionNames()).toEqual(["faq"]);
  });

  it("lists slugs from the named collection handle", () => {
    const content = createContent({ locale: "en", collections });
    expect([...content.faq.slugs()].sort()).toEqual(["hello", "moq"]);
  });
});
