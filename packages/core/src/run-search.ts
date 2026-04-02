/**
 * Programmatic API for searching content across collections.
 *
 * When a search index exists (built by `contenz build`), uses MiniSearch
 * for fast prefix/fuzzy search. Falls back to O(n) file parsing when no
 * index is available (pre-build scenario).
 */
import path from "node:path";
import { parseContentFile, parseFileName } from "./parser.js";
import type { ContentOpResult } from "./run-content-ops.js";
import { loadSearchIndex, querySearchIndex } from "./search-index.js";
import { createWorkspace } from "./workspace.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface SearchOptions {
  cwd: string;
  /** Collection to search within (required) */
  collection: string;
  /** Substring to match against slugs (optional) */
  query?: string;
  /** Field-value filters: only return items where meta[field] matches value */
  fields?: Record<string, string>;
  /** Locale filter (for i18n collections) */
  locale?: string;
  /** Maximum number of results (default: 50) */
  limit?: number;
}

export interface SearchResultItem {
  slug: string;
  locale: string | null;
  file: string;
  meta: Record<string, unknown>;
}

export interface SearchResultData {
  collection: string;
  query: string | null;
  filters: Record<string, string>;
  total: number;
  items: SearchResultItem[];
}

// ── Indexed search (fast path) ──────────────────────────────────────────────

async function searchWithIndex(cwd: string, opts: SearchOptions): Promise<SearchResultData | null> {
  const index = await loadSearchIndex(cwd);
  if (!index) return null;

  // MiniSearch requires query text; if only field filters, we need a fallback
  if (!opts.query) return null;

  const hits = querySearchIndex(index, {
    query: opts.query,
    collection: opts.collection,
    locale: opts.locale,
    fields: opts.fields,
    limit: opts.limit,
  });

  if (hits.length === 0 && !opts.query) return null;

  return {
    collection: opts.collection,
    query: opts.query ?? null,
    filters: opts.fields ?? {},
    total: hits.length,
    items: hits.map((h) => ({
      slug: h.slug,
      locale: h.locale,
      file: h.file,
      meta: h.meta,
    })),
  };
}

// ── Brute-force search (fallback) ───────────────────────────────────────────

async function searchBruteForce(opts: SearchOptions): Promise<SearchResultData> {
  const ws = await createWorkspace({ cwd: opts.cwd, collection: opts.collection });
  const col = ws.getCollection(opts.collection);

  if (!col) {
    throw new Error(`Collection not found: ${opts.collection}`);
  }

  const limit = opts.limit ?? 50;
  const items: SearchResultItem[] = [];

  for (const file of col.contentFiles.sort()) {
    const parsed = parseFileName(file, col.config.i18n, col.config.slugPattern);
    if (!parsed) continue;

    // Locale filter
    if (opts.locale && parsed.locale && parsed.locale !== opts.locale) continue;

    // Slug substring filter
    if (opts.query && !parsed.slug.includes(opts.query)) continue;

    // Parse content (needed for meta regardless of field filters)
    const filePath = path.join(col.collectionPath, file);
    const content = await parseContentFile(filePath, col.config);

    // Field-value filter
    if (opts.fields && Object.keys(opts.fields).length > 0) {
      const matches = Object.entries(opts.fields).every(
        ([field, expected]) =>
          content.meta[field] !== undefined && String(content.meta[field]) === expected
      );
      if (!matches) continue;
    }

    items.push({
      slug: parsed.slug,
      locale: parsed.locale ?? null,
      file,
      meta: content.meta,
    });

    if (items.length >= limit) break;
  }

  return {
    collection: opts.collection,
    query: opts.query ?? null,
    filters: opts.fields ?? {},
    total: items.length,
    items,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function runSearch(opts: SearchOptions): Promise<ContentOpResult<SearchResultData>> {
  try {
    // Try the fast indexed path first
    const indexedResult = await searchWithIndex(path.resolve(process.cwd(), opts.cwd ?? "."), opts);
    if (indexedResult) {
      return { success: true, data: indexedResult };
    }

    // Fall back to brute-force scan
    const data = await searchBruteForce(opts);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
