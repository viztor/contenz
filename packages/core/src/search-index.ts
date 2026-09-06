/**
 * Search index built on Orama for fast content queries.
 *
 * Node-side shell: filesystem load/save live here (`./api` only). All pure
 * operations (build, query, JSON persist/restore) live in `./search.js` and
 * are re-exported for backward compatibility — import `@contenz/core/search`
 * directly for edge-safe usage.
 */

import fs from "node:fs/promises";
import path from "node:path";

import {
  persistToFile,
  restoreFromFile,
} from "@orama/plugin-data-persistence/server";

import type { ContenzSearchIndex } from "./search.js";

export {
  addDocumentsToIndex,
  buildSearchDocument,
  collectMetaFieldNames,
  createSearchIndex,
  type ContenzSearchIndex,
  DEFAULT_SEARCH_EXCERPT_LENGTH,
  discardDocuments,
  persistIndexToJson,
  querySearchIndex,
  restoreIndexFromJson,
  type SearchDocument,
  type SearchIndexHit,
  type SearchIndexQuery,
} from "./search.js";

const CONTENZ_DIR = ".contenz";
const INDEX_FILENAME = "search-index.json";

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
