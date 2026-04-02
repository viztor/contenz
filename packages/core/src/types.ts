import type { ZodSchema } from "zod";
import type { FormatAdapter } from "./format-adapter.js";

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
 * Validates that slugs referenced in the field exist in the target collection.
 *
 * Field names are fully user-defined — use any name that fits your schema.
 *
 * @example
 * ```ts
 * export const { meta, relations } = defineCollection({
 *   schema,
 *   relations: {
 *     glossaryLinks: "glossary",   // any field name → target collection
 *     authorRef: "team",           // single reference field
 *     seeAlso: "faq",             // self-referencing relation
 *   },
 * });
 * ```
 */
export type Relations = Record<string, string>;

/**
 * Inline collection declaration for centralized config.
 * Allows defining collections directly in contenz.config.ts
 * instead of (or alongside) filesystem discovery.
 */
export interface CollectionDeclaration {
  /** Directory containing content files (relative to project root) */
  path: string;
  /** Inline Zod schema. If omitted, falls back to schema.ts in the directory. */
  schema?: ZodSchema;
  /** Inline relations mapping for this collection */
  relations?: Relations;
  /** Collection-level config overrides */
  config?: CollectionConfig;
}

/**
 * Rich i18n configuration (v2).
 * When i18n is enabled, optional fallback, coverage, and staleness options apply.
 */
export interface I18nConfigShape {
  /** Enable locale detection from filenames */
  enabled: boolean;
  /** Default locale (e.g. "en"); used for fallback and as source for staleness */
  defaultLocale?: string;
  /** Explicit list of locales; if omitted, locales are inferred from filenames */
  locales?: string[];
  /**
   * Locale fallback: locale -> fallback locale(s).
   * - Record: { "zh-Hant": "zh", "zh": "en" }
   * - Array: ["en"] means all locales fall back to "en"
   */
  fallback?: Record<string, string> | string[];
  /** Minimum coverage ratio (0–1) before warning/error; e.g. 0.8 = 80% */
  coverageThreshold?: number;
  /** Emit diagnostics when a translation file is older than the defaultLocale source */
  detectStale?: boolean;
  /** Include _fallback field in generated output when entry is from fallback locale */
  includeFallbackMetadata?: boolean;
}

/**
 * Root-level contenz configuration at /contenz.config.ts
 * These settings apply globally to all content collections.
 */
export interface ContenzConfig {
  /**
   * Source discovery patterns.
   * - `content/*` discovers collections under direct child folders
   * - `docs` treats `docs/` itself as a collection
   * Default: ["content/*"]
   */
  sources?: string[];
  /**
   * Legacy container root for collections.
   * @deprecated Use `sources`, for example `["content/*"]`.
   */
  contentDir?: string;
  /** Output directory for generated files (default: "generated/content") */
  outputDir?: string;
  /** Coverage report output path (default: "contenz.coverage.md" in project root) */
  coveragePath?: string;
  /** Fail build on warnings like missing translations (default: false) */
  strict?: boolean;
  /**
   * Enable locale detection from filenames (default: false).
   * Can be boolean (backward-compatible) or rich I18nConfigShape.
   */
  i18n?: boolean | I18nConfigShape;
  /** Supported file extensions (default: ["md", "mdx"]) */
  extensions?: string[];
  /** Glob patterns to ignore (default: ["README.md", "_*"]) */
  ignore?: string[];
  /**
   * Format adapters for content file parsing and serialization.
   * Register adapters for file formats beyond JSON (which is built-in).
   *
   * @example
   * ```ts
   * import { mdxAdapter } from "@contenz/adapter-mdx";
   * export const config: ContenzConfig = { adapters: [mdxAdapter] };
   * ```
   */
  adapters?: FormatAdapter[];
  /**
   * Inline collection declarations.
   * Define collections centrally instead of (or alongside) filesystem discovery.
   * If a collection name exists in both `collections` and filesystem discovery,
   * the inline declaration wins.
   *
   * @example
   * ```ts
   * collections: {
   *   faq: {
   *     path: "content/faq",
   *     schema: z.object({ question: z.string() }),
   *   },
   * }
   * ```
   */
  collections?: Record<string, CollectionDeclaration>;
}

/**
 * Collection-level configuration at a collection root, such as
 * `content/{collection}/config.ts` or `docs/config.ts`.
 * These settings override project defaults for a specific collection.
 */
export interface CollectionConfig {
  /** Multiple content types with pattern matchers */
  types?: ContentType[];
  /** Custom slug extraction regex */
  slugPattern?: RegExp;
  /** Override: enable locale detection from filenames (boolean or rich i18n config) */
  i18n?: boolean | I18nConfigShape;
  /** Override: supported file extensions */
  extensions?: string[];
  /** Override: glob patterns to ignore */
  ignore?: string[];
}

/**
 * Resolved i18n options used at build/lint time.
 */
export interface ResolvedI18nConfig {
  enabled: boolean;
  defaultLocale: string | null;
  /** Ordered locale list (default first when present) */
  locales: string[];
  /** Map: locale -> fallback locale (single step) */
  fallbackMap: Record<string, string>;
  coverageThreshold: number | null;
  detectStale: boolean;
  includeFallbackMetadata: boolean;
}

/**
 * Resolved configuration after merging all levels.
 */
export interface ResolvedConfig {
  sources: string[];
  outputDir: string;
  coveragePath: string;
  strict: boolean;
  /** When true, i18n is enabled (backward-compatible). Use resolvedI18n for full options. */
  i18n: boolean;
  /** Resolved i18n options (only meaningful when i18n is true) */
  resolvedI18n?: ResolvedI18nConfig;
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
  /** Content types with filename patterns; when present, overrides config.types when config does not set types */
  types?: ContentType[];
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
  /** Body only (content after meta block; not the raw file) */
  body?: string;
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
