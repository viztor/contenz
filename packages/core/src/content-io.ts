import fs from "node:fs/promises";
import path from "node:path";
import {
  type ContentExtension,
  parseContentFile,
  parseFileName,
  serializeContentFile,
} from "./parser.js";
import type { ParsedContent } from "./types.js";
import { type CollectionContext, createWorkspace } from "./workspace.js";

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
        (!locale && parsed.locale === col.config.resolvedI18n?.defaultLocale)
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
  const col = ws.getCollection(collectionName);
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
  const col = ws.getCollection(collectionName);
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
 * Loads workspace once — adapters are registered automatically.
 */
export async function writeContent(options: WriteContentOptions): Promise<ContentLocation> {
  const ws = await createWorkspace({ cwd: options.cwd, collection: options.collectionName });
  const col = ws.getCollection(options.collectionName);
  if (!col) {
    throw new Error(`Collection not found: ${options.collectionName}`);
  }

  const ext = options.ext ?? (col.config.extensions[0] as ContentExtension) ?? "mdx";
  let fileName = `${options.slug}.${ext}`;
  if (col.config.i18n) {
    const localeToUse = options.locale ?? col.config.resolvedI18n?.defaultLocale;
    if (!localeToUse) {
      throw new Error("Locale is required when i18n is enabled");
    }
    fileName = `${options.slug}.${localeToUse}.${ext}`;
  }

  const filePath = path.join(col.collectionPath, fileName);
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const content = serializeContentFile(options.meta, options.body ?? "", ext);
  await fs.writeFile(filePath, content, "utf-8");

  return {
    collectionName: options.collectionName,
    collectionPath: col.collectionPath,
    slug: options.slug,
    locale: options.locale,
    filePath,
    ext,
  };
}

/**
 * Surgically updates an existing content item, preserving body and format.
 * Loads workspace once — adapters are registered, no double-loading.
 */
export async function updateContent(
  cwd: string,
  collectionName: string,
  slug: string,
  mutations: { set?: Record<string, unknown>; unset?: string[] },
  locale?: string
): Promise<ParsedContent | null> {
  const ws = await createWorkspace({ cwd, collection: collectionName });
  const col = ws.getCollection(collectionName);
  if (!col) return null;

  const location = findContentFile(col, slug, locale);
  if (!location) return null;

  const current = await parseContentFile(location.filePath, col.config);

  // Apply mutations
  const newMeta = { ...current.meta };

  if (mutations.set) {
    for (const [key, value] of Object.entries(mutations.set)) {
      newMeta[key] = value;
    }
  }

  if (mutations.unset) {
    for (const key of mutations.unset) {
      delete newMeta[key];
    }
  }

  const newContent = serializeContentFile(newMeta, current.body ?? "", location.ext);
  await fs.writeFile(location.filePath, newContent, "utf-8");

  return {
    meta: newMeta,
    filePath: location.filePath,
    slug: current.slug,
    locale: current.locale,
    body: current.body,
  };
}
