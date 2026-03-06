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
 * Extract body from raw source (content after the meta block).
 * For .mdx: strips the leading `export const meta = { ... };`.
 * For .md: strips the leading `---` frontmatter block.
 */
export function extractBodyFromSource(source: string, ext: "mdx" | "md"): string {
  if (ext === "md") {
    const trimmed = source.trim();
    if (trimmed.startsWith("---")) {
      const end = trimmed.indexOf("\n---", 3);
      if (end !== -1) {
        return trimmed.slice(end + 4).trimStart();
      }
      return trimmed.slice(3).trimStart();
    }
    return source;
  }

  // .mdx: find "export const meta = " then match the value until };
  const metaStart = source.indexOf("export const meta = ");
  if (metaStart === -1) return source;

  let i = metaStart + "export const meta = ".length;
  const len = source.length;

  // Skip whitespace
  while (i < len && /[\s\n]/.test(source[i])) i++;
  if (i >= len) return source;

  // Balance braces/brackets and skip strings
  let depth = 0;
  const open = source[i];
  if (open === "{" || open === "[") {
    const close = open === "{" ? "}" : "]";
    depth = 1;
    i++;
    while (i < len && depth > 0) {
      const c = source[i];
      if (c === '"' || c === "'" || c === "`") {
        const quote = c;
        i++;
        while (i < len) {
          if (source[i] === "\\") i += 2;
          else if (source[i] === quote) {
            i++;
            break;
          } else i++;
        }
        continue;
      }
      if (c === open) depth++;
      else if (c === close) depth--;
      i++;
    }
  }

  // Skip until };
  while (i < len && source[i] !== ";") i++;
  if (source[i] === ";") i++;
  const rest = source.slice(i).trimStart();
  return rest;
}

/**
 * Serialize meta + body back to file content.
 * For .mdx: `export const meta = <JSON>;\n\n` + body.
 * For .md: `---\n` + JSON meta + `\n---\n\n` + body.
 */
export function serializeContentFile(
  meta: Record<string, unknown>,
  body: string,
  ext: "mdx" | "md"
): string {
  if (ext === "mdx") {
    const metaBlock = `export const meta = ${JSON.stringify(meta, null, 2)};\n\n`;
    return metaBlock + body;
  }
  const front = `---\n${JSON.stringify(meta)}\n---\n\n`;
  return front + body;
}

/**
 * Parse a content file and extract metadata and body.
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

  const body = extractBodyFromSource(source, parsed.ext);

  return {
    meta: meta ?? ({} as Record<string, unknown>),
    filePath,
    slug: parsed.slug,
    locale: parsed.locale,
    body,
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
    sources: ["content/*"],
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
