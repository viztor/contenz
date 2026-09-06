import { describe, expect, it } from "vitest";
import { z } from "zod";

import { mergeContenzConfig } from "./merge-config.js";

function noopHook(): void {
  // Module scope: shared across tests, nothing to capture.
}

describe("mergeContenzConfig", () => {
  it("merges disjoint keys and lets later scalars win", () => {
    const merged = mergeContenzConfig(
      { strict: false, outputDir: "gen" },
      { strict: true }
    );
    expect(merged).toMatchObject({ strict: true, outputDir: "gen" });
  });

  it("concatenates and dedupes arrays", () => {
    const adapter = { extensions: ["mdx"] };
    const merged = mergeContenzConfig(
      { sources: ["content/*"], ignore: ["README.md"], adapters: [adapter] },
      { sources: ["docs", "content/*"], ignore: ["_*"], adapters: [adapter] }
    );
    expect(merged.sources).toEqual(["content/*", "docs"]);
    expect(merged.ignore).toEqual(["README.md", "_*"]);
    // Same reference kept once, not duplicated.
    expect(merged.adapters).toEqual([adapter]);
  });

  it("deep-merges collections by name", () => {
    const schema = z.object({ title: z.string() });
    const merged = mergeContenzConfig(
      {
        collections: {
          faq: { path: "content/faq", config: { extensions: ["md"] } },
        },
      },
      { collections: { faq: { schema }, blog: { path: "content/blog" } } }
    );
    expect(merged.collections?.faq).toMatchObject({
      path: "content/faq",
      config: { extensions: ["md"] },
    });
    expect(merged.collections?.faq?.schema).toBe(schema);
    expect(merged.collections?.blog).toMatchObject({ path: "content/blog" });
  });

  it("replaces i18n boolean with object (last wins across kinds)", () => {
    const merged = mergeContenzConfig(
      { i18n: true },
      { i18n: { enabled: true, defaultLocale: "en" } }
    );
    expect(merged.i18n).toEqual({ enabled: true, defaultLocale: "en" });
  });

  it("skips undefined and falsy partials, ignores undefined values", () => {
    const merged = mergeContenzConfig(
      undefined,
      false,
      { strict: false, outputDir: undefined },
      null,
      { strict: true }
    );
    expect(merged.strict).toBe(true);
    expect("outputDir" in merged).toBe(false);
  });

  it("keeps non-plain values by reference (schemas, regexps, functions)", () => {
    const schema = z.object({ a: z.string() });
    const pattern = /^topic-/;
    const merged = mergeContenzConfig({
      collections: {
        terms: {
          path: "content/terms",
          schema,
          config: { slugPattern: pattern },
        },
      },
      hooks: { beforeBuild: noopHook },
    });
    expect(merged.collections?.terms?.schema).toBe(schema);
    expect(merged.collections?.terms?.config?.slugPattern).toBe(pattern);
    expect(merged.hooks?.beforeBuild).toBe(noopHook);
  });
});
