import path from "node:path";

import { nodeWritableStorage } from "../storage-node.js";
import { createWorkspace } from "../workspace.js";
import { createWriter } from "../writer.js";
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

    // Resolve the slug (singles default to their name) and load config once.
    // Everything registers as a dir-rooted writer collection: constructed
    // names are identical for collections and singles, so no special case.
    let slug = opts.slug;
    const ws = await createWorkspace({
      cwd: opts.cwd,
      collection: opts.collection,
    });
    if (!slug) {
      const single = ws.getSingle(opts.collection);
      if (!single) {
        return {
          success: false,
          error: `Slug is required (omit only for singles): ${opts.collection}`,
        };
      }
      slug = single.name;
    }
    const col =
      ws.getCollection(opts.collection) ?? ws.getSingle(opts.collection);
    if (!col) {
      return {
        success: false,
        error: `Content not found: ${opts.collection}/${slug}`,
      };
    }

    // Plan + apply through the writer (single code path for merge,
    // validation, serialization, and exact-locale targeting).
    const writer = createWriter(
      {
        collections: [
          {
            name: col.name,
            dir: "",
            schema: col.schema?.meta,
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
      plan = await writer.planUpdate(
        col.name,
        slug,
        {
          set: opts.set,
          unset: opts.unset,
        },
        opts.locale
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Content not found:")
      ) {
        return { success: false, error: error.message };
      }
      throw error;
    }
    if (!plan.valid) {
      return {
        success: false,
        error: "Validation failed",
        diagnostics: plan.diagnostics.map((e) => ({
          field: e.field,
          message: e.message,
        })),
      };
    }
    const receipt = await writer.apply(plan);

    return {
      success: true,
      data: {
        slug: receipt.slug,
        collection: opts.collection,
        file: path.join(col.collectionPath, receipt.file),
        meta: receipt.meta,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
