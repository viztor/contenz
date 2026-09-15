/**
 * Pure content parsing: filename conventions and source-to-content parsing.
 *
 * Zero `node:` imports — safe for the edge-readable `@contenz/core/reader`
 * entry. `parser.ts` re-exports this module for backward compatibility and
 * keeps the Node-only `parseContentFile` (fs read + delegate) there.
 */

import {
  type FormatAdapter,
  getAdapterForExtension,
} from "./format-adapter.js";
import type { ParsedContent } from "./types.js";

/** File extension for content files (e.g. "md", "mdx", "json"). */
export type ContentExtension = string;

export interface ParseFileNameResult {
  slug: string;
  locale?: string;
  ext: ContentExtension;
}

/** Default extensions used when no config-level extensions are specified. */
const DEFAULT_EXTENSIONS = ["mdx", "md", "json"];

// ⚡ Cache compiled RegExps keyed by extensions array reference to prevent recompilation in hot paths
const regexCache = new WeakMap<
  string[],
  { i18nPattern: RegExp; stdPattern: RegExp }
>();

/**
 * Get cached regex patterns for a given extensions array.
 * Creates and caches them if not found.
 */
function getCachedPatterns(extensions?: string[]): {
  i18nPattern: RegExp;
  stdPattern: RegExp;
} {
  const exts = extensions?.length ? extensions : DEFAULT_EXTENSIONS;
  let cached = regexCache.get(exts);

  if (!cached) {
    const alt = exts
      .map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    // BCP 47 locale: xx, xxx, xx-XX, xx-Xxxx, xx-Xxxx-XX, etc.
    const localePattern = "[a-z]{2,3}(?:-[A-Za-z]{2,4})*(?:-[A-Z]{2})?";

    cached = {
      i18nPattern: new RegExp(`^(.+)\\.(${localePattern})\\.(${alt})$`),
      stdPattern: new RegExp(`^(.+)\\.(${alt})$`),
    };
    regexCache.set(exts, cached);
  }

  return cached;
}

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

  const { i18nPattern, stdPattern } = getCachedPatterns(extensions);

  if (i18nEnabled) {
    const match = i18nPattern.exec(fileName);
    if (!match) return null;
    return {
      slug: match[1],
      locale: match[2],
      ext: match[3],
    };
  }

  const match = stdPattern.exec(fileName);
  if (!match) return null;
  return {
    slug: match[1],
    ext: match[2],
  };
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
  adapters: FormatAdapter[]
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
  adapters: FormatAdapter[]
): string {
  const adapter = getAdapterForExtension(ext, adapters);
  if (!adapter) {
    // Fallback for unknown extensions — mdx style
    const metaBlock = `export const meta = ${JSON.stringify(meta, null, 2)};\n\n`;
    return metaBlock + body;
  }
  return adapter.serialize(meta, body);
}

export interface ParseContentOptions {
  /** Whether filenames carry a locale segment */
  i18n: boolean;
  /** Custom filename pattern (overrides the convention) */
  slugPattern?: RegExp;
  /** Format adapters used to extract meta + body */
  adapters: FormatAdapter[];
  /** Allowed extensions for the filename alternation */
  extensions?: string[];
}

/**
 * Parse raw file source into structured content. Pure: no filesystem access.
 * `fileName` is the basename (used for slug/locale/ext inference);
 * `filePath` labels the result (defaults to `fileName`).
 */
export function parseContent(
  source: string,
  fileName: string,
  options: ParseContentOptions,
  filePath?: string
): ParsedContent {
  const parsed = parseFileName(
    fileName,
    options.i18n,
    options.slugPattern,
    options.extensions
  );

  if (!parsed) {
    const expectedFormat = options.i18n
      ? "{slug}.{locale}.mdx, {slug}.{locale}.md, or {slug}.{locale}.json"
      : "{slug}.mdx, {slug}.md, or {slug}.json";
    throw new Error(
      `Invalid file name format: ${fileName}. Expected ${expectedFormat}`
    );
  }

  const adapter = getAdapterForExtension(parsed.ext, options.adapters);

  if (!adapter) {
    throw new Error(
      `No format adapter registered for extension: .${parsed.ext}`
    );
  }

  const { meta, body } = adapter.extract(source, filePath ?? fileName);

  return {
    meta: meta ?? {},
    filePath: filePath ?? fileName,
    slug: parsed.slug,
    locale: parsed.locale,
    body,
  };
}
