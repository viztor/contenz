/**
 * Programmatic API for searching content across collections.
 * Supports slug substring matching and field-value filtering.
 */
import path from "node:path";
import { parseContentFile, parseFileName } from "./parser.js";
import type { ContentOpResult } from "./run-content-ops.js";
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

// ── Implementation ──────────────────────────────────────────────────────────

export async function runSearch(opts: SearchOptions): Promise<ContentOpResult<SearchResultData>> {
  try {
    const ws = await createWorkspace({ cwd: opts.cwd, collection: opts.collection });
    const col = ws.getCollection(opts.collection);

    if (!col) {
      return { success: false, error: `Collection not found: ${opts.collection}` };
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
      success: true,
      data: {
        collection: opts.collection,
        query: opts.query ?? null,
        filters: opts.fields ?? {},
        total: items.length,
        items,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
