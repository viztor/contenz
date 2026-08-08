import fs from "node:fs/promises";
import path from "node:path";

import { getAdapterForExtension } from "./format-adapter.js";
import type { ParsedContent, ResolvedConfig } from "./types.js";

/** File extension for content files (e.g. "md", "mdx", "json"). */
export type ContentExtension = string;

export interface ParseFileNameResult {
  slug: string;
  locale?: string;
  ext: ContentExtension;
}

/** Default extensions used when no config-level extensions are specified. */
const DEFAULT_EXTENSIONS = ["mdx", "md", "json"];
const DEFAULT_EXT_SET = new Set(DEFAULT_EXTENSIONS);

const localeRegex = /^[a-z]{2,3}(?:-[A-Za-z]{2,4})*(?:-[A-Z]{2})?$/;

/**
 * Parse filename to extract slug and optional locale.
 *
 * When i18n is enabled: expects {slug}.{locale}.{ext} (e.g., "moq.en.mdx")
 * When i18n is disabled: expects {slug}.{ext} (e.g., "hello-world.mdx")
 */
export function parseFileName(
  fileName: string,
  i18nEnabled: boolean,
  customPattern?: RegExp,
  extensions?: string[]
): ParseFileNameResult | null {
  // Use custom pattern if provided
  if (customPattern) {
    const match = fileName.match(customPattern);
    if (!match) return null;
    // Expect groups: slug, locale (optional), ext
    return {
      slug: match[1],
      locale: match[2],
      ext: match[3] || match[2],
    };
  }

  // ⚡ Bolt: Avoid dynamic regex compilation by using string manipulation and a static regex
  const extSet = extensions?.length ? new Set(extensions) : DEFAULT_EXT_SET;
  const lastDotIndex = fileName.lastIndexOf(".");

  if (lastDotIndex <= 0) return null;

  const ext = fileName.substring(lastDotIndex + 1);
  if (!extSet.has(ext)) return null;

  const base = fileName.substring(0, lastDotIndex);

  if (i18nEnabled) {
    const localeDotIndex = base.lastIndexOf(".");
    if (localeDotIndex <= 0) return null;

    const locale = base.substring(localeDotIndex + 1);

    if (!localeRegex.test(locale)) return null;

    return { slug: base.substring(0, localeDotIndex), locale, ext };
  }

  return { slug: base, ext };
}

/**
 * Extract body from raw source (content after the meta block).
 * For .mdx: strips the leading `export const meta = { ... };`.
 * For .md: strips the leading `---` frontmatter block.
 * For .json: no body.
 *
 * @deprecated Use FormatAdapter.extract() instead. Kept for backward compatibility.
 */
export function extractBodyFromSource(
  source: string,
  ext: ContentExtension,
  adapters: import("./format-adapter.js").FormatAdapter[]
): string {
  const adapter = getAdapterForExtension(ext, adapters);
  if (!adapter) return source;
  const result = adapter.extract(source, "");
  return result.body ?? "";
}

/**
 * Serialize meta + body back to file content.
 * For .mdx: `export const meta = <JSON>;\n\n` + body.
 * For .md: `---\n` + JSON meta + `\n---\n\n` + body.
 * For .json: JSON.stringify(meta).
 */
export function serializeContentFile(
  meta: Record<string, unknown>,
  body: string,
  ext: ContentExtension,
  adapters: import("./format-adapter.js").FormatAdapter[]
): string {
  const adapter = getAdapterForExtension(ext, adapters);
  if (!adapter) {
    // Fallback for unknown extensions — mdx style
    const metaBlock = `export const meta = ${JSON.stringify(meta, null, 2)};\n\n`;
    return metaBlock + body;
  }
  return adapter.serialize(meta, body);
}

/**
 * Parse a content file and extract metadata and body.
 *
 * Uses FormatAdapter for lightweight extraction.
 * For .mdx files: parses `export const meta = { ... }` via string extraction
 * For .md files: parses YAML/JSON frontmatter
 * For .json files: parses the entire file as JSON metadata
 */
export async function parseContentFile(
  filePath: string,
  config: ResolvedConfig
): Promise<ParsedContent> {
  const fileName = path.basename(filePath);
  const parsed = parseFileName(fileName, config.i18n, config.slugPattern);

  if (!parsed) {
    const expectedFormat = config.i18n
      ? "{slug}.{locale}.mdx, {slug}.{locale}.md, or {slug}.{locale}.json"
      : "{slug}.mdx, {slug}.md, or {slug}.json";
    throw new Error(
      `Invalid file name format: ${fileName}. Expected ${expectedFormat}`
    );
  }

  const source = await fs.readFile(filePath, "utf-8");
  const adapter = getAdapterForExtension(parsed.ext, config.adapters);

  if (!adapter) {
    throw new Error(
      `No format adapter registered for extension: .${parsed.ext}`
    );
  }

  const { meta, body } = adapter.extract(source, filePath);

  return {
    meta: meta ?? {},
    filePath,
    slug: parsed.slug,
    locale: parsed.locale,
    body,
  };
}
