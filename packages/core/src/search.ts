/**
 * Pure search index operations (Orama): build, query, and JSON persistence.
 *
 * Zero `node:` imports — safe for the edge-readable `@contenz/core/search`
 * entry. Filesystem load/save live in `./search-index.js` (`./api` only).
 * The index *format* is shared by writer and reader sides within this package
 * so build-time and edge-time can never disagree on it.
 */

import {
  create,
  insertMultiple,
  type Orama,
  remove,
  search,
} from "@orama/orama";
import { persist, restore } from "@orama/plugin-data-persistence";

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
 * Serialize an index to a JSON string (pure; no filesystem).
 * Pair with `restoreIndexFromJson` for the edge round-trip:
 * build persists → JSON artifact → fetch → restore → query.
 */
export async function persistIndexToJson(
  index: ContenzSearchIndex
): Promise<string> {
  const out = await persist(index, "json");
  if (typeof out === "string") return out;
  const bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
  return new TextDecoder().decode(bytes);
}

/**
 * Restore an index from a JSON string produced by `persistIndexToJson`.
 */
export async function restoreIndexFromJson(
  json: string
): Promise<ContenzSearchIndex> {
  return restore<ContenzSearchIndex>("json", json);
}

// ── Document operations ─────────────────────────────────────────────────────

/**
 * Default body excerpt length for indexed documents. Bodies dominate index
 * size (~99% for typical docs); excerpting trades deep-content recall for
 * edge-friendly weight. `null` disables excerpting (full bodies).
 */
export const DEFAULT_SEARCH_EXCERPT_LENGTH = 2000;

export function buildSearchDocument(
  collection: string,
  slug: string,
  locale: string | undefined,
  file: string,
  meta: Record<string, unknown>,
  body: string | undefined,
  excerptLength: number | null = DEFAULT_SEARCH_EXCERPT_LENGTH
): SearchDocument {
  const loc = locale ?? "_";
  const rawBody = body ?? "";
  const excerpted =
    excerptLength === null ? rawBody : rawBody.slice(0, excerptLength);
  const doc: SearchDocument = {
    id: `${collection}:${slug}:${loc}`,
    collection,
    slug,
    locale: loc,
    file,
    body: excerpted,
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
