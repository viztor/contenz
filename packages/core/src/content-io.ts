import fs from "node:fs/promises";
import path from "node:path";
import { loadCollectionConfig, loadProjectConfig, resolveConfig } from "./config.js";
import {
  type ContentExtension,
  parseContentFile,
  parseFileName,
  serializeContentFile,
} from "./parser.js";
import { discoverCollections, globContentFiles } from "./sources.js";
import type { ParsedContent, ResolvedConfig } from "./types.js";

export interface ContentLocation {
  collectionName: string;
  collectionPath: string;
  slug: string;
  locale?: string;
  filePath: string;
  ext: ContentExtension;
}

/** Internal resolved context shared across read/write/update operations */
interface ResolvedCollectionContext {
  collectionPath: string;
  config: ResolvedConfig;
}

/** Internal: load project + collection config + discover a collection */
async function resolveCollection(
  cwd: string,
  collectionName: string
): Promise<ResolvedCollectionContext | null> {
  const projectConfig = await loadProjectConfig(cwd);
  const discovery = await discoverCollections(cwd, projectConfig.sources ?? ["content/*"]);
  const collection = discovery.collections.find((c) => c.name === collectionName);

  if (!collection) return null;

  const collectionConfig = await loadCollectionConfig(collection.collectionPath);
  const config = resolveConfig(projectConfig, collectionConfig);

  return { collectionPath: collection.collectionPath, config };
}

/**
 * Internal: find a content file by slug within an already-resolved collection.
 * Separated from resolveCollection so callers can load config once.
 */
async function findContentFile(
  ctx: ResolvedCollectionContext,
  collectionName: string,
  slug: string,
  locale?: string
): Promise<ContentLocation | null> {
  const { collectionPath, config } = ctx;
  const contentFiles = await globContentFiles(collectionPath, config.extensions, config.ignore);

  for (const file of contentFiles) {
    const parsed = parseFileName(file, config.i18n, config.slugPattern);
    if (!parsed || parsed.slug !== slug) continue;

    if (config.i18n) {
      if (
        (locale && parsed.locale === locale) ||
        (!locale && parsed.locale === config.resolvedI18n?.defaultLocale)
      ) {
        return {
          collectionName,
          collectionPath,
          slug: parsed.slug,
          locale: parsed.locale,
          filePath: path.join(collectionPath, file),
          ext: parsed.ext,
        };
      }
    } else {
      return {
        collectionName,
        collectionPath,
        slug: parsed.slug,
        filePath: path.join(collectionPath, file),
        ext: parsed.ext,
      };
    }
  }

  return null;
}

/**
 * Resolves a slug to an existing file path within a collection.
 * Public API — loads config internally.
 */
export async function resolveContentFile(
  cwd: string,
  collectionName: string,
  slug: string,
  locale?: string
): Promise<ContentLocation | null> {
  const ctx = await resolveCollection(cwd, collectionName);
  if (!ctx) {
    throw new Error(`Collection not found: ${collectionName}`);
  }
  return findContentFile(ctx, collectionName, slug, locale);
}

/**
 * Reads a content item by slug.
 * Loads config once — no double-loading.
 */
export async function readContent(
  cwd: string,
  collectionName: string,
  slug: string,
  locale?: string
): Promise<ParsedContent | null> {
  const ctx = await resolveCollection(cwd, collectionName);
  if (!ctx) return null;

  const location = await findContentFile(ctx, collectionName, slug, locale);
  if (!location) return null;

  return parseContentFile(location.filePath, ctx.config);
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
 */
export async function writeContent(options: WriteContentOptions): Promise<ContentLocation> {
  const ctx = await resolveCollection(options.cwd, options.collectionName);
  if (!ctx) {
    throw new Error(`Collection not found: ${options.collectionName}`);
  }

  const { collectionPath, config } = ctx;
  const ext = options.ext ?? (config.extensions[0] as ContentExtension) ?? "mdx";
  let fileName = `${options.slug}.${ext}`;
  if (config.i18n) {
    const localeToUse = options.locale ?? config.resolvedI18n?.defaultLocale;
    if (!localeToUse) {
      throw new Error("Locale is required when i18n is enabled");
    }
    fileName = `${options.slug}.${localeToUse}.${ext}`;
  }

  const filePath = path.join(collectionPath, fileName);
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const content = serializeContentFile(options.meta, options.body ?? "", ext);
  await fs.writeFile(filePath, content, "utf-8");

  return {
    collectionName: options.collectionName,
    collectionPath,
    slug: options.slug,
    locale: options.locale,
    filePath,
    ext,
  };
}

/**
 * Surgically updates an existing content item, preserving body and format.
 * Loads config once — no double-loading. Returns updated state without re-reading from disk.
 */
export async function updateContent(
  cwd: string,
  collectionName: string,
  slug: string,
  mutations: { set?: Record<string, unknown>; unset?: string[] },
  locale?: string
): Promise<ParsedContent | null> {
  const ctx = await resolveCollection(cwd, collectionName);
  if (!ctx) return null;

  const location = await findContentFile(ctx, collectionName, slug, locale);
  if (!location) return null;

  const current = await parseContentFile(location.filePath, ctx.config);

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
