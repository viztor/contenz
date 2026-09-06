import { readContent, updateContent } from "../content-io.js";
import { validateMeta } from "../validator.js";
import { createWorkspace } from "../workspace.js";
import type { ContentOpResult } from "./shared.js";

export interface UpdateOptions {
  cwd: string;
  collection: string;
  /** Omit only for singles (defaults to the single name) */
  slug?: string;
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

export async function runUpdate(
  opts: UpdateOptions
): Promise<ContentOpResult<UpdateResult>> {
  try {
    const hasSet = opts.set && Object.keys(opts.set).length > 0;
    const hasUnset = opts.unset && opts.unset.length > 0;

    if (!hasSet && !hasUnset) {
      return {
        success: false,
        error: "No mutations specified. Use --set or --unset.",
      };
    }

    // Read current content (workspace loaded + adapters registered internally)
    let slug = opts.slug;
    if (!slug) {
      const ws = await createWorkspace({
        cwd: opts.cwd,
        collection: opts.collection,
      });
      const single = ws.getSingle(opts.collection);
      if (!single) {
        return {
          success: false,
          error: `Slug is required (omit only for singles): ${opts.collection}`,
        };
      }
      slug = single.name;
    }
    const current = await readContent(
      opts.cwd,
      opts.collection,
      slug,
      opts.locale
    );
    if (!current) {
      return {
        success: false,
        error: `Content not found: ${opts.collection}/${slug}`,
      };
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
    const ws = await createWorkspace({
      cwd: opts.cwd,
      collection: opts.collection,
    });
    const col =
      ws.getCollection(opts.collection) ?? ws.getSingle(opts.collection);
    if (col?.schema?.meta) {
      const validation = validateMeta(
        mergedMeta,
        col.schema.meta,
        `${opts.collection}/${slug}`
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
      slug,
      { set: opts.set ?? {}, unset: opts.unset ?? [] },
      opts.locale
    );

    if (!result) {
      return {
        success: false,
        error: `Content not found: ${opts.collection}/${slug}`,
      };
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
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
