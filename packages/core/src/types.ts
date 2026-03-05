import type { ZodSchema } from "zod";

/**
 * Content type definition for multi-type collections.
 * Used when a single collection contains different content types (e.g., terms + topics).
 */
export interface ContentType {
  /** Type name - schema export is `{name}Meta` (e.g., "term" → termMeta) */
  name: string;
  /** Filename pattern matcher - first match wins */
  pattern: RegExp;
}

/**
 * Relations mapping: field name → target collection name.
 * Validates that slugs in the field exist in the target collection.
 *
 * @example
 * ```ts
 * export const relations = {
 *   relatedTerms: "terms",    // validates against terms collection
 *   relatedFaqs: "faq",       // validates against faq collection
 *   featuredTerms: "terms",   // non-standard field name
 * };
 * ```
 */
export type Relations = Record<string, string>;

/**
 * Root-level contenz configuration at /contenz.config.ts
 * These settings apply globally to all content collections.
 */
export interface ContenzConfig {
  /** Root directory for content (default: "content") */
  contentDir?: string;
  /** Output directory for generated files (default: "generated/content") */
  outputDir?: string;
  /** Coverage report output path (default: "contenz.coverage.md" in project root) */
  coveragePath?: string;
  /** Fail build on warnings like missing translations (default: false) */
  strict?: boolean;
  /** Enable locale detection from filenames (default: false) */
  i18n?: boolean;
  /** Supported file extensions (default: ["md", "mdx"]) */
  extensions?: string[];
  /** Glob patterns to ignore (default: ["README.md", "_*"]) */
  ignore?: string[];
}

/**
 * Collection-level configuration at contenz/{collection}/config.ts
 * These settings override project defaults for a specific collection.
 */
export interface CollectionConfig {
  /** Multiple content types with pattern matchers */
  types?: ContentType[];
  /** Custom slug extraction regex */
  slugPattern?: RegExp;
  /** Override: enable locale detection from filenames */
  i18n?: boolean;
  /** Override: supported file extensions */
  extensions?: string[];
  /** Override: glob patterns to ignore */
  ignore?: string[];
}

/**
 * Resolved configuration after merging all levels.
 */
export interface ResolvedConfig {
  contentDir: string;
  outputDir: string;
  coveragePath: string;
  strict: boolean;
  i18n: boolean;
  extensions: string[];
  ignore: string[];
  types?: ContentType[];
  slugPattern?: RegExp;
}

/**
 * Schema module exports expected from schema.ts files.
 */
export interface SchemaModule {
  /** Default schema for single-type collections */
  meta?: ZodSchema;
  /** Named schemas for multi-type collections (e.g., termMeta, topicMeta) */
  [key: `${string}Meta`]: ZodSchema | undefined;
  /** Relations mapping for this collection */
  relations?: Relations;
}

/**
 * Config module exports expected from config.ts files.
 */
export interface ConfigModule {
  config?: CollectionConfig;
}

/**
 * Parsed content file result.
 */
export interface ParsedContent {
  /** Extracted metadata from frontmatter or export const meta */
  meta: Record<string, unknown>;
  /** Full file path */
  filePath: string;
  /** Extracted slug from filename */
  slug: string;
  /** Locale code (when i18n enabled) */
  locale?: string;
  /** Content type name (for multi-type collections) */
  type?: string;
}

/**
 * Collection data item for a single slug.
 */
export interface CollectionItem {
  slug: string;
  /** Locale-specific entries (when i18n: true) */
  locales?: Record<string, { file: string; meta: Record<string, unknown> }>;
  /** Single entry (when i18n: false) */
  file?: string;
  meta?: Record<string, unknown>;
}

/**
 * Collection statistics for coverage reporting.
 */
export interface CollectionStats {
  total: number;
  locales?: Record<string, number>;
  missingTranslations?: string[];
}
