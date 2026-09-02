import { describe, expect, it } from "vitest";

import {
  getFallbackChain,
  isI18nEnabled,
  normalizeI18nConfig,
  resolveI18nEntry,
} from "./i18n.js";

describe("normalizeI18nConfig", () => {
  it("returns an inert config when disabled", () => {
    for (const raw of [false, undefined, { enabled: false } as const]) {
      const config = normalizeI18nConfig(raw);
      expect(config.enabled).toBe(false);
      expect(config.locales).toEqual([]);
      expect(config.fallbackChains).toEqual({});
      expect(config.defaultFallbackChain).toEqual([]);
      expect(config.outputStrategy).toBe("merged");
    }
  });

  it("accepts boolean true", () => {
    expect(isI18nEnabled(true)).toBe(true);
    expect(normalizeI18nConfig(true).enabled).toBe(true);
  });

  it("reads shape fields and clamps nothing silently", () => {
    const config = normalizeI18nConfig({
      enabled: true,
      defaultLocale: "en",
      locales: ["en", "zh", "en"],
      coverageThreshold: 0.9,
      detectStale: true,
      includeFallbackMetadata: true,
      outputStrategy: "split",
    });
    expect(config.defaultLocale).toBe("en");
    expect(config.locales).toEqual(["en", "zh"]);
    expect(config.coverageThreshold).toBe(0.9);
    expect(config.detectStale).toBe(true);
    expect(config.includeFallbackMetadata).toBe(true);
    expect(config.outputStrategy).toBe("split");
  });

  it("rejects out-of-range coverage thresholds", () => {
    expect(
      normalizeI18nConfig({ enabled: true, coverageThreshold: 1.5 })
        .coverageThreshold
    ).toBeNull();
    expect(
      normalizeI18nConfig({ enabled: true, coverageThreshold: -0.1 })
        .coverageThreshold
    ).toBeNull();
  });

  it("normalizes array fallback to the global default chain", () => {
    const config = normalizeI18nConfig({
      enabled: true,
      fallback: ["zh", "en"],
    });
    expect(config.defaultFallbackChain).toEqual(["zh", "en"]);
    expect(config.fallbackChains).toEqual({});
    expect(config.fallbackMap).toEqual({ __default: "zh" });
  });

  it("normalizes record fallback with string and array chains", () => {
    const config = normalizeI18nConfig({
      enabled: true,
      fallback: { "zh-TW": ["zh", "en"], de: "en" },
    });
    expect(config.fallbackChains).toEqual({
      "zh-TW": ["zh", "en"],
      de: ["en"],
    });
    expect(config.fallbackMap).toEqual({ "zh-TW": "zh", de: "en" });
    expect(config.defaultFallbackChain).toEqual([]);
  });

  it("supports the __default sentinel in record fallback", () => {
    const config = normalizeI18nConfig({
      enabled: true,
      fallback: { "zh-TW": "zh", __default: "en" },
    });
    expect(config.fallbackChains).toEqual({ "zh-TW": ["zh"] });
    expect(config.defaultFallbackChain).toEqual(["en"]);
    expect(config.fallbackMap).toEqual({ "zh-TW": "zh", __default: "en" });
  });
});

describe("resolveI18nEntry", () => {
  const locales = {
    "moq.en": { file: "moq.en.mdx", meta: { q: "MOQ?" } },
    "moq.zh": { file: "moq.zh.mdx", meta: { q: "起订量？" } },
  };
  const keyed = {
    en: locales["moq.en"],
    zh: locales["moq.zh"],
  };

  it("returns the direct entry without _fallback", () => {
    const resolved = resolveI18nEntry(keyed, "en", {
      fallbackChains: {},
      defaultFallbackChain: [],
    });
    expect(resolved).toEqual({ file: "moq.en.mdx", meta: { q: "MOQ?" } });
  });

  it("walks per-locale chains in order", () => {
    const resolved = resolveI18nEntry(keyed, "zh-TW", {
      fallbackChains: { "zh-TW": ["zh", "en"] },
      defaultFallbackChain: [],
    });
    expect(resolved?.file).toBe("moq.zh.mdx");
    expect(resolved?._fallback).toBe("zh");
  });

  it("falls through to the next chain entry when the first fallback is missing", () => {
    const resolved = resolveI18nEntry(keyed, "zh-TW", {
      fallbackChains: { "zh-TW": ["ja", "en"] },
      defaultFallbackChain: [],
    });
    expect(resolved?.file).toBe("moq.en.mdx");
    expect(resolved?._fallback).toBe("en");
  });

  it("uses the global default chain for locales without a specific chain", () => {
    const resolved = resolveI18nEntry(keyed, "fr", {
      fallbackChains: {},
      defaultFallbackChain: ["en"],
    });
    expect(resolved?.file).toBe("moq.en.mdx");
    expect(resolved?._fallback).toBe("en");
  });

  it("prefers per-locale chains over the global default", () => {
    const resolved = resolveI18nEntry(keyed, "zh-TW", {
      fallbackChains: { "zh-TW": ["zh"] },
      defaultFallbackChain: ["en"],
    });
    expect(resolved?._fallback).toBe("zh");
  });

  it("always reports provenance via _fallback on fallback hits", () => {
    const resolved = resolveI18nEntry(keyed, "zh-TW", {
      fallbackChains: { "zh-TW": ["zh"] },
      defaultFallbackChain: [],
    });
    expect(resolved?._fallback).toBe("zh");
    const direct = resolveI18nEntry(keyed, "en", {
      fallbackChains: {},
      defaultFallbackChain: [],
    });
    expect(direct?._fallback).toBeUndefined();
  });

  it("returns null when no locale in the chain has content", () => {
    expect(
      resolveI18nEntry(keyed, "fr", {
        fallbackChains: { fr: ["de"] },
        defaultFallbackChain: [],
      })
    ).toBeNull();
  });

  it("guards against cycles in chains", () => {
    const resolved = resolveI18nEntry(keyed, "zh-TW", {
      fallbackChains: { "zh-TW": ["ja"], ja: ["zh-TW", "en"] },
      defaultFallbackChain: [],
    });
    // zh-TW -> ja (missing) -> chain walk for "zh-TW" only reads the
    // top-level chain, so ja's own chain is never followed. No infinite loop.
    expect(resolved).toBeNull();
  });
});

describe("getFallbackChain", () => {
  it("returns locale + per-locale chain", () => {
    expect(
      getFallbackChain("zh-TW", {
        fallbackChains: { "zh-TW": ["zh", "en"] },
        defaultFallbackChain: ["en"],
      })
    ).toEqual(["zh-TW", "zh", "en"]);
  });

  it("returns locale + global default when no per-locale chain", () => {
    expect(
      getFallbackChain("fr", {
        fallbackChains: { "zh-TW": ["zh"] },
        defaultFallbackChain: ["en"],
      })
    ).toEqual(["fr", "en"]);
  });
});
