import fs from "node:fs/promises";
import path from "node:path";

import { parseContent } from "./parse-content.js";
import type { ParsedContent, ResolvedConfig } from "./types.js";

export {
  type ContentExtension,
  extractBodyFromSource,
  type ParseContentOptions,
  parseContent,
  parseFileName,
  type ParseFileNameResult,
  serializeContentFile,
} from "./parse-content.js";

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
  const source = await fs.readFile(filePath, "utf-8");
  return parseContent(
    source,
    fileName,
    {
      i18n: config.i18n,
      slugPattern: config.slugPattern,
      adapters: config.adapters,
    },
    filePath
  );
}
