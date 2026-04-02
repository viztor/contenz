/**
 * Search index built on MiniSearch for fast content queries.
 *
 * The index is built incrementally during `contenz build` and persisted to
 * `.contenz/search-index.json`. When available, `runSearch` loads it for
 * O(1) startup + fast prefix/fuzzy queries instead of O(n) file parsing.
 *
 * Collection-level incremental updates: on rebuild, only changed collections
 * have their documents removed and re-added. Unchanged collections are untouched.
 */

import fs from "node:fs/promises";
import path from "node:path";
import MiniSearch from "minisearch";

const CONTENZ_DIR = ".contenz";
const INDEX_FILENAME = "search-index.json";

// ── Document shape ──────────────────────────────────────────────────────────

export interface SearchDocument {
  /** Unique: `{collection}:{slug}:{locale|_}` */
  id: string;
  collection: string;
  slug: string;
  locale: string;
  file: string;
  body: string;
  /** JSON-serialized meta for storage; individual meta fields are spread as top-level for search */
  _metaJson: string;
  /** Dynamic meta fields are spread here at indexing time */
  [field: string]: unknown;
}

// ── Index fields configuration ──────────────────────────────────────────────

/** Fields that are always indexed and always searchable */
const CORE_FIELDS = ["slug", "body"] as const;

/** Fields stored but not searched */
const STORED_FIELDS = ["collection", "slug", "locale", "file", "_metaJson"] as const;

/**
 * Build the MiniSearch options. We register a superset of known fields;
 * MiniSearch silently skips missing fields on individual documents.
 *
 * @param metaFields - extra meta field names to make searchable
 */
function buildOptions(metaFields: string[] = []) {
  const searchFields = [...CORE_FIELDS, ...metaFields];
  return {
    fields: searchFields,
    storeFields: [...STORED_FIELDS] as string[],
    idField: "id" as const,
  };
}

// ── Index lifecycle ─────────────────────────────────────────────────────────

/**
 * Create a fresh, empty MiniSearch index.
 */
export function createSearchIndex(metaFields: string[] = []): MiniSearch<SearchDocument> {
  return new MiniSearch<SearchDocument>(buildOptions(metaFields));
}

/**
 * Load a previously serialized search index from `.contenz/search-index.json`.
 * Returns null if the file does not exist or is invalid.
 */
export async function loadSearchIndex(cwd: string): Promise<MiniSearch<SearchDocument> | null> {
  const indexPath = path.join(cwd, CONTENZ_DIR, INDEX_FILENAME);
  try {
    const raw = await fs.readFile(indexPath, "utf-8");
    const parsed = JSON.parse(raw);
    const metaFields = Array.isArray(parsed._metaFields) ? parsed._metaFields : [];
    const opts = buildOptions(metaFields);
    return MiniSearch.loadJSON<SearchDocument>(parsed.index, opts);
  } catch {
    return null;
  }
}

/**
 * Save a search index to `.contenz/search-index.json`.
 * Stores the index JSON alongside the meta field names needed to reload it.
 */
export async function saveSearchIndex(
  cwd: string,
  index: MiniSearch<SearchDocument>,
  metaFields: string[]
): Promise<void> {
  const dir = path.join(cwd, CONTENZ_DIR);
  await fs.mkdir(dir, { recursive: true });
  const indexPath = path.join(dir, INDEX_FILENAME);
  const payload = JSON.stringify({
    version: 1,
    generatedAt: new Date().toISOString(),
    _metaFields: metaFields,
    index: JSON.parse(JSON.stringify(index)),
  });
  await fs.writeFile(indexPath, payload, "utf-8");
}

// ── Document operations ─────────────────────────────────────────────────────

/**
 * Build a SearchDocument from parsed content.
 */
export function buildSearchDocument(
  collection: string,
  slug: string,
  locale: string | undefined,
  file: string,
  meta: Record<string, unknown>,
  body: string | undefined
): SearchDocument {
  const loc = locale ?? "_";
  const doc: SearchDocument = {
    id: `${collection}:${slug}:${loc}`,
    collection,
    slug,
    locale: loc,
    file,
    body: body ?? "",
    _metaJson: JSON.stringify(meta),
  };

  // Spread string meta fields so MiniSearch can index them
  for (const [key, value] of Object.entries(meta)) {
    if (typeof value === "string") {
      doc[key] = value;
    } else if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
      doc[key] = value.join(" ");
    }
  }

  return doc;
}



/**
 * Discard specific document IDs from the index.
 * Uses MiniSearch's `discard()` which marks documents as deleted
 * without rebuilding the entire index.
 */
export function discardDocuments(index: MiniSearch<SearchDocument>, ids: string[]): void {
  for (const id of ids) {
    try {
      index.discard(id);
    } catch {
      // ID not in index — skip silently
    }
  }
}

/**
 * Add documents to the index.
 */
export function addDocumentsToIndex(
  index: MiniSearch<SearchDocument>,
  docs: SearchDocument[]
): void {
  index.addAll(docs);
}

/**
 * Collect all unique string-valued meta field names from a set of documents.
 * Used to register searchable meta fields in the index configuration.
 */
export function collectMetaFieldNames(docs: SearchDocument[]): string[] {
  const fields = new Set<string>();
  for (const doc of docs) {
    const meta = JSON.parse(doc._metaJson) as Record<string, unknown>;
    for (const [key, value] of Object.entries(meta)) {
      if (
        typeof value === "string" ||
        (Array.isArray(value) && value.every((v) => typeof v === "string"))
      ) {
        fields.add(key);
      }
    }
  }
  return [...fields].sort();
}

// ── Query ───────────────────────────────────────────────────────────────────

export interface SearchIndexQuery {
  query?: string;
  collection?: string;
  locale?: string;
  fields?: Record<string, string>;
  limit?: number;
}

export interface SearchIndexHit {
  slug: string;
  locale: string | null;
  file: string;
  meta: Record<string, unknown>;
  score: number;
}

/**
 * Query the search index. Returns ranked results with metadata.
 */
export function querySearchIndex(
  index: MiniSearch<SearchDocument>,
  opts: SearchIndexQuery
): SearchIndexHit[] {
  const limit = opts.limit ?? 50;

  // If no query text, do an exhaustive scan via wildcard prefix search
  // on a very short term to match broadly, then filter.
  // MiniSearch requires at least some query text. If none provided,
  // we fall back to listing all docs in the collection.
  if (!opts.query && !opts.fields) {
    // No search criteria — fall back to brute force (caller should handle)
    return [];
  }

  const queryText = opts.query ?? "";

  // If we have query text, use MiniSearch's native search
  if (queryText.length > 0) {
    const raw = index.search(queryText, {
      prefix: true,
      fuzzy: 0.2,
      boost: { slug: 3 },
      filter: (result) => {
        const doc = result as unknown as SearchDocument;
        if (opts.collection && doc.collection !== opts.collection) return false;
        if (opts.locale && doc.locale !== opts.locale && doc.locale !== "_") return false;
        return true;
      },
    });

    const hits: SearchIndexHit[] = [];
    for (const result of raw) {
      if (hits.length >= limit) break;

      const stored = result as unknown as {
        collection?: string;
        slug?: string;
        locale?: string;
        file?: string;
        _metaJson?: string;
      };

      const meta = stored._metaJson ? JSON.parse(stored._metaJson) : {};

      // Apply field filters
      if (opts.fields && Object.keys(opts.fields).length > 0) {
        const matches = Object.entries(opts.fields).every(
          ([field, expected]) => meta[field] !== undefined && String(meta[field]) === expected
        );
        if (!matches) continue;
      }

      hits.push({
        slug: stored.slug ?? "",
        locale: stored.locale === "_" ? null : (stored.locale ?? null),
        file: stored.file ?? "",
        meta,
        score: result.score,
      });
    }

    return hits;
  }

  // Query text is empty but we have field filters — use autoSuggest trick:
  // search for every field value as a query
  if (opts.fields && Object.keys(opts.fields).length > 0) {
    // Build a combined query from all field values
    const combinedQuery = Object.values(opts.fields).join(" ");
    if (combinedQuery.length === 0) return [];

    return querySearchIndex(index, {
      ...opts,
      query: combinedQuery,
      fields: opts.fields,
    });
  }

  return [];
}
