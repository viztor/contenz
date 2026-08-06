/**
 * Search index built on Orama for fast content queries.
 *
 * The index is built incrementally during `contenz build` and persisted to
 * `.contenz/search-index.json`. When available, `runSearch` loads it for
 * fast prefix/fuzzy queries.
 */

import fs from "node:fs/promises";
import path from "node:path";

import {
  create,
  insertMultiple,
  type Orama,
  remove,
  search,
} from "@orama/orama";
import {
  persistToFile,
  restoreFromFile,
} from "@orama/plugin-data-persistence/server";

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

// ── Index lifecycle ─────────────────────────────────────────────────────────

/**
 * Build the Orama schema.
 */
function buildSchema(metaFields: string[] = []) {
  const schema: Record<string, "string"> = {
    id: "string",
    collection: "string",
    slug: "string",
    locale: "string",
    file: "string",
    body: "string",
    _metaJson: "string",
  };

  for (const field of metaFields) {
    if (!schema[field]) {
      schema[field] = "string";
    }
  }

  return schema;
}

// biome-ignore lint/suspicious/noExplicitAny: Orama types require any
export type ContenzSearchIndex = Orama<any>;

/**
 * Create a fresh, empty Orama index.
 */
export async function createSearchIndex(
  metaFields: string[] = []
): Promise<ContenzSearchIndex> {
  // Orama `create` is synchronous; keep async signature for API stability.
  return create({
    schema: buildSchema(metaFields),
  });
}

/**
 * Load a previously serialized search index from `.contenz/search-index.json`.
 */
export async function loadSearchIndex(
  cwd: string
): Promise<ContenzSearchIndex | null> {
  const indexPath = path.join(cwd, CONTENZ_DIR, INDEX_FILENAME);
  try {
    const db = await restoreFromFile("json", indexPath);
    return db as ContenzSearchIndex;
  } catch {
    return null;
  }
}

/**
 * Save a search index to `.contenz/search-index.json`.
 */
export async function saveSearchIndex(
  cwd: string,
  index: ContenzSearchIndex,
  _metaFields: string[] // Kept for API compat
): Promise<void> {
  const dir = path.join(cwd, CONTENZ_DIR);
  await fs.mkdir(dir, { recursive: true });
  const indexPath = path.join(dir, INDEX_FILENAME);

  await persistToFile(index, "json", indexPath);
}

// ── Document operations ─────────────────────────────────────────────────────

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

  // Spread string meta fields so Orama can index them
  for (const [key, value] of Object.entries(meta)) {
    if (typeof value === "string") {
      doc[key] = value;
    } else if (
      Array.isArray(value) &&
      value.every((v) => typeof v === "string")
    ) {
      doc[key] = value.join(" ");
    }
  }

  return doc;
}

export async function discardDocuments(
  index: ContenzSearchIndex,
  ids: string[]
): Promise<void> {
  for (const id of ids) {
    await remove(index, id);
  }
}

export async function addDocumentsToIndex(
  index: ContenzSearchIndex,
  docs: SearchDocument[]
): Promise<void> {
  // biome-ignore lint/suspicious/noExplicitAny: Orama types require any
  await insertMultiple(index, docs as any[]);
}

export function collectMetaFieldNames(docs: SearchDocument[]): string[] {
  const fields = new Set<string>();

  // ⚡ Bolt Optimization: Avoid JSON.parse in the hot path.
  // Since buildSearchDocument spreads valid meta fields (string and string[]) directly onto
  // the SearchDocument object, we can iterate its top-level keys and ignore the standard fields.
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    for (const key in doc) {
      if (
        key === "id" ||
        key === "collection" ||
        key === "slug" ||
        key === "locale" ||
        key === "file" ||
        key === "body" ||
        key === "_metaJson"
      ) {
        continue;
      }
      fields.add(key);
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

export async function querySearchIndex(
  index: ContenzSearchIndex,
  opts: SearchIndexQuery
): Promise<SearchIndexHit[]> {
  const limit = opts.limit ?? 50;

  if (!opts.query && !opts.fields) {
    return [];
  }

  const queryText = opts.query ?? "";

  if (queryText.length > 0) {
    const { hits } = await search(index, {
      term: queryText,
      limit,
      where: {
        ...(opts.collection ? { collection: opts.collection } : {}),
        ...(opts.locale ? { locale: opts.locale } : {}),
        ...(opts.fields ? opts.fields : {}),
      },
    });

    return hits.map((hit) => {
      const doc = hit.document as unknown as SearchDocument;
      return {
        slug: doc.slug,
        locale: doc.locale === "_" ? null : doc.locale,
        file: doc.file,
        meta: JSON.parse(doc._metaJson),
        score: hit.score,
      };
    });
  }

  // If no query text but has fields
  if (opts.fields && Object.keys(opts.fields).length > 0) {
    const { hits } = await search(index, {
      term: "",
      limit,
      where: {
        ...(opts.collection ? { collection: opts.collection } : {}),
        ...(opts.locale ? { locale: opts.locale } : {}),
        ...(opts.fields ? opts.fields : {}),
      },
    });

    return hits.map((hit) => {
      const doc = hit.document as unknown as SearchDocument;
      return {
        slug: doc.slug,
        locale: doc.locale === "_" ? null : doc.locale,
        file: doc.file,
        meta: JSON.parse(doc._metaJson),
        score: hit.score,
      };
    });
  }

  return [];
}
