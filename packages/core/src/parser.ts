import fs from "node:fs/promises";
import path from "node:path";
import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import type { ParsedContent, ResolvedConfig } from "./types.js";

export interface ParseFileNameResult {
  slug: string;
  locale?: string;
  ext: "mdx" | "md";
}

// Pattern for i18n: {slug}.{locale}.{ext}
const I18N_PATTERN = /^(.+)\.([a-z]{2}(?:-[A-Z]{2})?)\.(mdx|md)$/;
// Pattern for non-i18n: {slug}.{ext}
const NON_I18N_PATTERN = /^(.+)\.(mdx|md)$/;

/**
 * Parse filename to extract slug and optional locale.
 *
 * When i18n is enabled: expects {slug}.{locale}.{ext} (e.g., "moq.en.mdx")
 * When i18n is disabled: expects {slug}.{ext} (e.g., "hello-world.mdx")
 */
export function parseFileName(
  fileName: string,
  i18nEnabled: boolean,
  customPattern?: RegExp
): ParseFileNameResult | null {
  // Use custom pattern if provided
  if (customPattern) {
    const match = fileName.match(customPattern);
    if (!match) return null;
    // Expect groups: slug, locale (optional), ext
    return {
      slug: match[1],
      locale: match[2],
      ext: (match[3] || match[2]) as "mdx" | "md",
    };
  }

  if (i18nEnabled) {
    const match = fileName.match(I18N_PATTERN);
    if (!match) return null;
    return {
      slug: match[1],
      locale: match[2],
      ext: match[3] as "mdx" | "md",
    };
  } else {
    const match = fileName.match(NON_I18N_PATTERN);
    if (!match) return null;
    return {
      slug: match[1],
      ext: match[2] as "mdx" | "md",
    };
  }
}

/**
 * Parse a content file and extract metadata.
 *
 * For .mdx files: expects `export const meta = { ... }`
 * For .md files: uses remark plugins to convert frontmatter to meta export
 */
export async function parseContentFile(
  filePath: string,
  config: ResolvedConfig
): Promise<ParsedContent> {
  const fileName = path.basename(filePath);
  const parsed = parseFileName(fileName, config.i18n, config.slugPattern);

  if (!parsed) {
    const expectedFormat = config.i18n
      ? "{slug}.{locale}.mdx or {slug}.{locale}.md"
      : "{slug}.mdx or {slug}.md";
    throw new Error(`Invalid file name format: ${fileName}. Expected ${expectedFormat}`);
  }

  const source = await fs.readFile(filePath, "utf-8");
  const isMdx = parsed.ext === "mdx";

  const mdxModule = await evaluate(source, {
    ...runtime,
    remarkPlugins: isMdx ? [] : [remarkFrontmatter, [remarkMdxFrontmatter, { name: "meta" }]],
    development: false,
  });

  const meta = (mdxModule as { meta?: Record<string, unknown> }).meta;

  return {
    meta: meta ?? ({} as Record<string, unknown>),
    filePath,
    slug: parsed.slug,
    locale: parsed.locale,
  };
}

/**
 * Legacy function for backward compatibility.
 * @deprecated Use parseContentFile with config instead.
 */
export async function parseContentFileLegacy(
  filePath: string
): Promise<ParsedContent & { locale: string }> {
  const result = await parseContentFile(filePath, {
    contentDir: "content",
    outputDir: "generated/content",
    coveragePath: "contenz.coverage.md",
    strict: false,
    i18n: true,
    extensions: ["md", "mdx"],
    ignore: [],
  });

  if (!result.locale) {
    throw new Error(`Expected locale in filename: ${filePath}`);
  }

  return result as ParsedContent & { locale: string };
}
