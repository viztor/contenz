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
const LOCALE_REGEX = /^[a-z]{2,3}(?:-[A-Za-z]{2,4})*(?:-[A-Z]{2})?$/;

/**
 * Parse filename to extract slug and optional locale.
 *
 * When i18n is enabled: expects {slug}.{locale}.{ext} (e.g., "moq.en.mdx")
 * When i18n is disabled: expects {slug}.{ext} (e.g., "hello-world.mdx")
 *
 * ⚡ Bolt: Removed dynamic RegExp compilation and replaced with standard string
 * operations (`endsWith`, `slice`, `lastIndexOf`) and a single static RegExp for locales.
 * This prevents expensive RegExp instantiation on a critical hot path when scanning many files.
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

  const exts = extensions?.length ? extensions : DEFAULT_EXTENSIONS;

  let matchedExt: string | undefined;
  for (const ext of exts) {
    if (fileName.endsWith(`.${ext}`)) {
      // Find the longest matching extension to handle multi-dot custom extensions
      if (!matchedExt || ext.length > matchedExt.length) {
        matchedExt = ext;
      }
    }
  }

  if (!matchedExt) {
    return null;
  }

  const withoutExt = fileName.slice(0, -(matchedExt.length + 1));
  if (withoutExt.length === 0) return null;

  if (i18nEnabled) {
    const lastDotIdx = withoutExt.lastIndexOf(".");
    if (lastDotIdx === -1 || lastDotIdx === 0) {
      return null;
    }
    const slug = withoutExt.slice(0, lastDotIdx);
    const locale = withoutExt.slice(lastDotIdx + 1);

    if (!LOCALE_REGEX.test(locale)) {
      return null;
    }

    return {
      slug,
      locale,
      ext: matchedExt,
    };
  } else {
    return {
      slug: withoutExt,
      ext: matchedExt,
    };
  }
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
    throw new Error(`Invalid file name format: ${fileName}. Expected ${expectedFormat}`);
  }

  const source = await fs.readFile(filePath, "utf-8");
  const adapter = getAdapterForExtension(parsed.ext, config.adapters);

  if (!adapter) {
    throw new Error(`No format adapter registered for extension: .${parsed.ext}`);
  }

  const { meta, body } = adapter.extract(source, filePath);

  return {
    meta: meta ?? ({} as Record<string, unknown>),
    filePath,
    slug: parsed.slug,
    locale: parsed.locale,
    body,
  };
}
