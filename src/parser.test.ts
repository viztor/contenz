import { describe, expect, it } from "vitest";
import { parseFileName } from "./parser.js";

describe("parseFileName", () => {
  describe("i18n disabled", () => {
    it("parses slug and ext from simple filename", () => {
      expect(parseFileName("hello.mdx", false)).toEqual({
        slug: "hello",
        ext: "mdx",
      });
      expect(parseFileName("hello-world.md", false)).toEqual({
        slug: "hello-world",
        ext: "md",
      });
    });

    it("parses i18n-style filename as slug when i18n disabled (no locale split)", () => {
      // With i18n disabled, "hello.en.mdx" is treated as slug "hello.en", ext "mdx"
      expect(parseFileName("hello.en.mdx", false)).toEqual({
        slug: "hello.en",
        ext: "mdx",
      });
    });

    it("returns null for invalid extension", () => {
      expect(parseFileName("hello.txt", false)).toBeNull();
    });
  });

  describe("i18n enabled", () => {
    it("parses slug, locale, and ext", () => {
      expect(parseFileName("moq.en.mdx", true)).toEqual({
        slug: "moq",
        locale: "en",
        ext: "mdx",
      });
      expect(parseFileName("term.zh-CN.md", true)).toEqual({
        slug: "term",
        locale: "zh-CN",
        ext: "md",
      });
    });

    it("returns null for non-i18n filename when i18n enabled", () => {
      expect(parseFileName("hello.mdx", true)).toBeNull();
    });
  });

  describe("custom pattern", () => {
    it("uses custom regex when provided", () => {
      const pattern = /^(.+)-(\w{2})\.(mdx|md)$/;
      expect(parseFileName("slug-xx.mdx", false, pattern)).toEqual({
        slug: "slug",
        locale: "xx",
        ext: "mdx",
      });
    });

    it("returns null when custom pattern does not match", () => {
      const pattern = /^topic-(.+)\.mdx$/;
      expect(parseFileName("other.mdx", false, pattern)).toBeNull();
    });
  });
});
