import { readContent, updateContent } from "../content-io.js";
import { validateMeta } from "../validator.js";
import { createWorkspace } from "../workspace.js";
import type { ContentOpResult } from "./shared.js";

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
    const current = await readContent(
      opts.cwd,
      opts.collection,
      opts.slug,
      opts.locale
    );
    if (!current) {
      return {
        success: false,
        error: `Content not found: ${opts.collection}/${opts.slug}`,
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
        mergedMeta[key] = undefined;
      }
    }

    // Validate the merged meta against the schema (reuses cached workspace)
    const ws = await createWorkspace({
      cwd: opts.cwd,
      collection: opts.collection,
    });
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
      return {
        success: false,
        error: `Content not found: ${opts.collection}/${opts.slug}`,
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
