import { describe, expect, it } from "vitest";

import { createT, getLocalizedItem } from "../t.js";

const faq = {
  moq: {
    slug: "moq",
    locales: {
      en: {
        slug: "moq",
        file: "moq.en.json",
        question: "What is MOQ?",
        category: "products",
      },
      zh: {
        slug: "moq",
        file: "moq.zh.json",
        question: "最低起订量是多少？",
        category: "products",
      },
    },
  },
  hello: {
    slug: "hello",
    locales: {
      en: { slug: "hello", file: "hello.en.json", question: "How do I order?" },
    },
  },
} as const;

const posts = {
  "hello-world": {
    slug: "hello-world",
    file: "hello-world.json",
    title: "Hello World",
    draft: false,
  },
} as const;

describe("createT", () => {
  it("reads a localized string field", () => {
    const t = createT({ locale: "zh", defaultLocale: "en" });
    expect(t(faq, "moq", "question")).toBe("最低起订量是多少？");
  });

  it("reads the default locale", () => {
    const t = createT({ locale: "en", defaultLocale: "en" });
    expect(t(faq, "moq", "question")).toBe("What is MOQ?");
  });

  it("falls back to defaultLocale when target locale is missing", () => {
    const t = createT({ locale: "ja", defaultLocale: "en" });
    expect(t(faq, "hello", "question")).toBe("How do I order?");
    expect(t.item(faq, "hello")?._resolvedFrom).toBe("en");
  });

  it("follows configured fallback chain", () => {
    const t = createT({
      locale: "zh-Hant",
      defaultLocale: "en",
      fallback: { "zh-Hant": "zh", zh: "en" },
    });
    expect(t(faq, "moq", "question")).toBe("最低起订量是多少？");
  });

  it("returns undefined for missing slug or field", () => {
    const t = createT({ locale: "en" });
    expect(t(faq, "nonexistent", "question")).toBeUndefined();
    expect(t(faq, "moq", "nonexistent")).toBeUndefined();
  });

  it("exposes item() for the full localized entry", () => {
    const t = createT({ locale: "zh", defaultLocale: "en" });
    expect(t.item(faq, "moq")).toMatchObject({
      slug: "moq",
      question: "最低起订量是多少？",
      file: "moq.zh.json",
    });
    expect(t.locale).toBe("zh");
  });

  it("works with flat (non-i18n) collections", () => {
    const t = createT({ locale: "en" });
    expect(t(posts, "hello-world", "title")).toBe("Hello World");
    expect(t.item(posts, "hello-world")).toMatchObject({
      title: "Hello World",
    });
  });
});

describe("getLocalizedItem", () => {
  it("resolves without createT wrapper", () => {
    const entry = getLocalizedItem(faq, "moq", {
      locale: "en",
      defaultLocale: "en",
    });
    expect(entry?.question).toBe("What is MOQ?");
  });
});
