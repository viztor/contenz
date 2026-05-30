import path from "node:path";
import { introspectSchema } from "../introspect.js";
import { parseFileName } from "../parser.js";
import { createWorkspace } from "../workspace.js";
import type { ContentOpResult } from "./shared.js";

export interface ListOptions {
  cwd: string;
  collection?: string;
}

export interface CollectionInfo {
  name: string;
  path: string;
  items: number;
  i18n: boolean;
  fields?: string[];
}

export interface ListItemInfo {
  slug: string;
  locale: string | null;
  file: string;
  ext: string;
}

export async function runList(
  opts: ListOptions
): Promise<
  ContentOpResult<{ collections: CollectionInfo[] } | { collection: string; items: ListItemInfo[] }>
> {
  try {
    const ws = await createWorkspace({ cwd: opts.cwd, collection: opts.collection });

    if (!opts.collection) {
      const collections: CollectionInfo[] = ws.collections.map((col) => {
        const info: CollectionInfo = {
          name: col.name,
          path: path.relative(opts.cwd, col.collectionPath),
          items: col.contentFiles.length,
          i18n: !!col.config.i18n,
        };

        if (col.schema?.meta) {
          const introspected = introspectSchema(col.schema.meta);
          info.fields = Object.keys(introspected.fields);
        }

        return info;
      });

      return { success: true, data: { collections } };
    }

    // List items in a specific collection
    const col = ws.getCollection(opts.collection);
    if (!col) {
      return { success: false, error: `Collection not found: ${opts.collection}` };
    }

    const items: ListItemInfo[] = [];
    for (const file of col.contentFiles.sort()) {
      const parsed = parseFileName(file, col.config.i18n, col.config.slugPattern);
      if (parsed) {
        items.push({
          slug: parsed.slug,
          locale: parsed.locale ?? null,
          file,
          ext: parsed.ext,
        });
      }
    }

    return { success: true, data: { collection: opts.collection, items } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
