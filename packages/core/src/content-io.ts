import path from "node:path";

import {
  type ContentExtension,
  parseContentFile,
  parseFileName,
} from "./parser.js";
import { nodeWritableStorage } from "./storage-node.js";
import type { ParsedContent } from "./types.js";
import { type CollectionContext, createWorkspace } from "./workspace.js";
import { createWriter } from "./writer.js";

export interface ContentLocation {
  collectionName: string;
  collectionPath: string;
  slug: string;
  locale?: string;
  filePath: string;
  ext: ContentExtension;
}

/**
 * Internal: find a content file by slug within an already-loaded collection context.
 */
function findContentFile(
  col: CollectionContext,
  slug: string,
  locale?: string
): ContentLocation | null {
  for (const file of col.contentFiles) {
    const parsed = parseFileName(file, col.config.i18n, col.config.slugPattern);
    if (!parsed || parsed.slug !== slug) continue;

    if (col.config.i18n) {
      if (
        (locale && parsed.locale === locale) ||
        (!locale && parsed.locale === col.config.resolvedI18n.defaultLocale)
      ) {
        return {
          collectionName: col.name,
          collectionPath: col.collectionPath,
          slug: parsed.slug,
          locale: parsed.locale,
          filePath: path.join(col.collectionPath, file),
          ext: parsed.ext,
        };
      }
    } else {
      return {
        collectionName: col.name,
        collectionPath: col.collectionPath,
        slug: parsed.slug,
        filePath: path.join(col.collectionPath, file),
        ext: parsed.ext,
      };
    }
  }

  return null;
}

/**
 * Resolves a slug to an existing file path within a collection.
 * Loads workspace (registers adapters) internally.
 */
export async function resolveContentFile(
  cwd: string,
  collectionName: string,
  slug: string,
  locale?: string
): Promise<ContentLocation | null> {
  const ws = await createWorkspace({ cwd, collection: collectionName });
  const col = ws.getCollection(collectionName) ?? ws.getSingle(collectionName);
  if (!col) {
    throw new Error(`Collection not found: ${collectionName}`);
  }
  return findContentFile(col, slug, locale);
}

/**
 * Reads a content item by slug.
 * Loads workspace once — adapters are registered automatically.
 */
export async function readContent(
  cwd: string,
  collectionName: string,
  slug: string,
  locale?: string
): Promise<ParsedContent | null> {
  const ws = await createWorkspace({ cwd, collection: collectionName });
  const col = ws.getCollection(collectionName) ?? ws.getSingle(collectionName);
  if (!col) return null;

  const location = findContentFile(col, slug, locale);
  if (!location) return null;

  return parseContentFile(location.filePath, col.config);
}

export interface WriteContentOptions {
  cwd: string;
  collectionName: string;
  slug: string;
  locale?: string;
  meta: Record<string, unknown>;
  body?: string;
  ext?: ContentExtension;
}

/**
 * Writes a new content item or overwrites an existing one completely.
 * Delegates to the writer (single code path for planning + serialization);
 * this shell maps workspace config to writer options and absolute paths.
 */
export async function writeContent(
  options: WriteContentOptions
): Promise<ContentLocation> {
  const ws = await createWorkspace({
    cwd: options.cwd,
    collection: options.collectionName,
  });
  const col =
    ws.getCollection(options.collectionName) ??
    ws.getSingle(options.collectionName);
  if (!col) {
    throw new Error(`Collection not found: ${options.collectionName}`);
  }

  const writer = createWriter(
    {
      // dir "" roots the writer at the collection directory; names are
      // constructed exactly as before. Writes never validate or fill
      // defaults here (runCreate owns that, mirroring prior behavior).
      collections: [
        {
          name: col.name,
          dir: "",
          validate: false,
          extensions: col.config.extensions,
        },
      ],
      i18n: col.config.resolvedI18n,
      adapters: ws.projectConfig.adapters,
    },
    nodeWritableStorage({ root: col.collectionPath })
  );
  const plan = await writer.planCreate(col.name, options.slug, options.meta, {
    locale: options.locale,
    ext: options.ext,
    body: options.body,
    fillDefaults: false,
  });
  const receipt = await writer.apply(plan);

  const ext = receipt.file.slice(receipt.file.lastIndexOf(".") + 1);
  return {
    collectionName: options.collectionName,
    collectionPath: col.collectionPath,
    slug: options.slug,
    locale: options.locale,
    filePath: path.join(col.collectionPath, receipt.file),
    ext,
  };
}

/**
 * Surgically updates an existing content item, preserving body and format.
 * Delegates to the writer (single code path); maps the receipt back to the
 * historical `ParsedContent` shape.
 */
export async function updateContent(
  cwd: string,
  collectionName: string,
  slug: string,
  mutations: { set?: Record<string, unknown>; unset?: string[] },
  locale?: string
): Promise<ParsedContent | null> {
  const ws = await createWorkspace({ cwd, collection: collectionName });
  const col = ws.getCollection(collectionName) ?? ws.getSingle(collectionName);
  if (!col) return null;

  const writer = createWriter(
    {
      collections: [
        {
          name: col.name,
          dir: "",
          validate: false,
          extensions: col.config.extensions,
        },
      ],
      i18n: col.config.resolvedI18n,
      adapters: ws.projectConfig.adapters,
    },
    nodeWritableStorage({ root: col.collectionPath })
  );

  let plan;
  try {
    plan = await writer.planUpdate(col.name, slug, mutations, locale);
  } catch (err) {
    // Missing file (and empty mutations) read as null, as before.
    if (
      err instanceof Error &&
      (err.message.startsWith("Content not found:") ||
        err.message.startsWith("No mutations specified"))
    ) {
      return null;
    }
    throw err;
  }
  const receipt = await writer.apply(plan);

  return {
    meta: plan.meta,
    filePath: path.join(col.collectionPath, receipt.file),
    slug: plan.slug,
    locale: plan.locale ?? undefined,
    body: plan.body,
  };
}
