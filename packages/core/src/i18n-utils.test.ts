import { describe, expect, it } from "vitest";
import { negotiateLocale, parseLocaleFromURL } from "./i18n-utils.js";

describe("parseLocaleFromURL", () => {
  const opts = { locales: ["en", "zh", "ja"], defaultLocale: "en" };

  describe("prefix strategy (default)", () => {
    it("extracts locale from first path segment", () => {
      const result = parseLocaleFromURL("/en/faq/moq", opts);
      expect(result).toEqual({ locale: "en", pathname: "/faq/moq", explicit: true });
    });

    it("extracts zh locale", () => {
      const result = parseLocaleFromURL("/zh/about", opts);
      expect(result).toEqual({ locale: "zh", pathname: "/about", explicit: true });
    });

    it("returns default when no locale prefix", () => {
      const result = parseLocaleFromURL("/faq/moq", opts);
      expect(result).toEqual({ locale: "en", pathname: "/faq/moq", explicit: false });
    });

    it("returns default for root path", () => {
      const result = parseLocaleFromURL("/", opts);
      expect(result).toEqual({ locale: "en", pathname: "/", explicit: false });
    });

    it("handles locale-only path", () => {
      const result = parseLocaleFromURL("/ja", opts);
      expect(result).toEqual({ locale: "ja", pathname: "/", explicit: true });
    });

    it("is case-insensitive on locale match", () => {
      const result = parseLocaleFromURL("/EN/faq", opts);
      expect(result.locale).toBe("en");
      expect(result.explicit).toBe(true);
    });

    it("does not match unknown locale prefix", () => {
      const result = parseLocaleFromURL("/fr/faq", opts);
      expect(result).toEqual({ locale: "en", pathname: "/fr/faq", explicit: false });
    });

    it("works with URL object", () => {
      const url = new URL("https://example.com/zh/blog");
      const result = parseLocaleFromURL(url, opts);
      expect(result).toEqual({ locale: "zh", pathname: "/blog", explicit: true });
    });

    it("works with full URL string", () => {
      const result = parseLocaleFromURL("https://example.com/ja/about", opts);
      expect(result).toEqual({ locale: "ja", pathname: "/about", explicit: true });
    });
  });

  describe("query strategy", () => {
    const queryOpts = { ...opts, strategy: "query" as const };

    it("extracts locale from default query param", () => {
      const result = parseLocaleFromURL("/faq?lang=zh", queryOpts);
      expect(result).toEqual({ locale: "zh", pathname: "/faq", explicit: true });
    });

    it("returns default when query param missing", () => {
      const result = parseLocaleFromURL("/faq", queryOpts);
      expect(result).toEqual({ locale: "en", pathname: "/faq", explicit: false });
    });

    it("returns default when query param has unknown locale", () => {
      const result = parseLocaleFromURL("/faq?lang=fr", queryOpts);
      expect(result).toEqual({ locale: "en", pathname: "/faq", explicit: false });
    });

    it("uses custom query param name", () => {
      const customOpts = { ...queryOpts, queryParam: "locale" };
      const result = parseLocaleFromURL("/faq?locale=ja", customOpts);
      expect(result).toEqual({ locale: "ja", pathname: "/faq", explicit: true });
    });
  });
});

describe("negotiateLocale", () => {
  const available = ["en", "zh", "ja"];

  it("returns exact match", () => {
    expect(negotiateLocale("en", available, "en")).toBe("en");
    expect(negotiateLocale("zh", available, "en")).toBe("zh");
  });

  it("respects quality weights", () => {
    expect(negotiateLocale("zh;q=0.9,en;q=1.0", available, "en")).toBe("en");
    expect(negotiateLocale("zh;q=1.0,en;q=0.8", available, "en")).toBe("zh");
  });

  it("matches prefix: zh-TW → zh", () => {
    expect(negotiateLocale("zh-TW", available, "en")).toBe("zh");
  });

  it("returns default when no match", () => {
    expect(negotiateLocale("fr,de;q=0.9", available, "en")).toBe("en");
  });

  it("returns default for empty header", () => {
    expect(negotiateLocale("", available, "en")).toBe("en");
  });

  it("handles complex Accept-Language header", () => {
    expect(negotiateLocale("zh-TW,zh;q=0.9,en;q=0.8", available, "en")).toBe("zh");
  });

  it("skips q=0 entries", () => {
    expect(negotiateLocale("zh;q=0,en;q=0.5", available, "en")).toBe("en");
  });

  it("matches reverse prefix: request 'zh' matches available 'zh-Hant'", () => {
    const extAvailable = ["en", "zh-Hant", "ja"];
    expect(negotiateLocale("zh", extAvailable, "en")).toBe("zh-Hant");
  });

  it("prefers exact match over prefix match", () => {
    const extAvailable = ["en", "zh", "zh-Hant"];
    expect(negotiateLocale("zh", extAvailable, "en")).toBe("zh");
  });
});
