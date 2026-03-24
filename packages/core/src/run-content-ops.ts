/**
 * Programmatic API for AI-native content operations.
 * These mirror the pattern used by runLint/runBuild:
 * - Accept a clean options object
 * - Return a structured result (never call console.log or process.exit)
 * - All error handling is internal
 */
import path from "node:path";
import { readContent, updateContent, writeContent } from "./content-io.js";
import { introspectSchema } from "./introspect.js";
import { type ContentExtension, parseFileName } from "./parser.js";
import { validateMeta } from "./validator.js";
import { createWorkspace } from "./workspace.js";

// ── Shared types ────────────────────────────────────────────────────────────

export interface ContentOpResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  diagnostics?: Array<{ field?: string; message: string }>;
}

// ── runList ──────────────────────────────────────────────────────────────────

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

// ── runView ──────────────────────────────────────────────────────────────────

export interface ViewOptions {
  cwd: string;
  collection: string;
  slug: string;
  locale?: string;
}

export interface ViewResult {
  slug: string;
  locale: string | null;
  file: string;
  meta: Record<string, unknown>;
  body?: string;
}

export async function runView(opts: ViewOptions): Promise<ContentOpResult<ViewResult>> {
  try {
    const result = await readContent(opts.cwd, opts.collection, opts.slug, opts.locale);

    if (!result) {
      return { success: false, error: `Content not found: ${opts.collection}/${opts.slug}` };
    }

    return {
      success: true,
      data: {
        slug: result.slug,
        locale: result.locale ?? null,
        file: result.filePath,
        meta: result.meta,
        body: result.body,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ── runCreate ────────────────────────────────────────────────────────────────

export interface CreateOptions {
  cwd: string;
  collection: string;
  slug: string;
  meta: Record<string, unknown>;
  locale?: string;
  contentType?: string;
}

export interface CreateResult {
  slug: string;
  collection: string;
  file: string;
  meta: Record<string, unknown>;
}

export async function runCreate(opts: CreateOptions): Promise<ContentOpResult<CreateResult>> {
  try {
    const ws = await createWorkspace({ cwd: opts.cwd, collection: opts.collection });
    const col = ws.getCollection(opts.collection);

    if (!col) {
      return { success: false, error: `Collection not found: ${opts.collection}` };
    }

    if (!col.schema?.meta) {
      return { success: false, error: `No schema found for collection: ${opts.collection}` };
    }

    // Fill defaults from schema introspection
    const meta = { ...opts.meta };
    const introspected = introspectSchema(col.schema.meta);
    for (const [fieldName, field] of Object.entries(introspected.fields)) {
      if (meta[fieldName] === undefined && field.default !== undefined) {
        meta[fieldName] = field.default;
      }
    }

    // Validate against schema
    const validation = validateMeta(meta, col.schema.meta, `${opts.collection}/${opts.slug}`);
    if (!validation.valid) {
      return {
        success: false,
        error: "Validation failed",
        diagnostics: validation.errors.map((e) => ({
          field: e.field,
          message: e.message,
        })),
      };
    }

    const location = await writeContent({
      cwd: opts.cwd,
      collectionName: opts.collection,
      slug: opts.slug,
      locale: opts.locale,
      meta,
      ext: (col.config.extensions[0] ?? "mdx") as ContentExtension,
    });

    return {
      success: true,
      data: {
        slug: opts.slug,
        collection: opts.collection,
        file: location.filePath,
        meta,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ── runUpdate ────────────────────────────────────────────────────────────────

export interface UpdateOptions {
  cwd: string;
  collection: string;
  slug: string;
  set?: Record<string, unknown>;
  unset?: string[];
  locale?: string;
}

export interface UpdateResult {
  slug: string;
  collection: string;
  file: string;
  meta: Record<string, unknown>;
}

export async function runUpdate(opts: UpdateOptions): Promise<ContentOpResult<UpdateResult>> {
  try {
    const hasSet = opts.set && Object.keys(opts.set).length > 0;
    const hasUnset = opts.unset && opts.unset.length > 0;

    if (!hasSet && !hasUnset) {
      return { success: false, error: "No mutations specified. Use --set or --unset." };
    }

    // Read current content (workspace loaded + adapters registered internally)
    const current = await readContent(opts.cwd, opts.collection, opts.slug, opts.locale);
    if (!current) {
      return { success: false, error: `Content not found: ${opts.collection}/${opts.slug}` };
    }

    // Compute the merged meta after mutations
    const mergedMeta = { ...current.meta };
    if (opts.set) {
      for (const [key, value] of Object.entries(opts.set)) {
        mergedMeta[key] = value;
      }
    }
    if (opts.unset) {
      for (const key of opts.unset) {
        delete mergedMeta[key];
      }
    }

    // Validate the merged meta against the schema (reuses cached workspace)
    const ws = await createWorkspace({ cwd: opts.cwd, collection: opts.collection });
    const col = ws.getCollection(opts.collection);
    if (col?.schema?.meta) {
      const validation = validateMeta(
        mergedMeta,
        col.schema.meta,
        `${opts.collection}/${opts.slug}`
      );
      if (!validation.valid) {
        return {
          success: false,
          error: "Validation failed",
          diagnostics: validation.errors.map((e) => ({
            field: e.field,
            message: e.message,
          })),
        };
      }
    }

    // Validation passed — apply the update
    const result = await updateContent(
      opts.cwd,
      opts.collection,
      opts.slug,
      { set: opts.set ?? {}, unset: opts.unset ?? [] },
      opts.locale
    );

    if (!result) {
      return { success: false, error: `Content not found: ${opts.collection}/${opts.slug}` };
    }

    return {
      success: true,
      data: {
        slug: result.slug,
        collection: opts.collection,
        file: result.filePath,
        meta: result.meta,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
