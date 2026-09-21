import path from "node:path";

import { nodeWritableStorage } from "../storage-node.js";
import { createWorkspace } from "../workspace.js";
import { createWriter } from "../writer.js";
import type { ContentOpResult } from "./shared.js";

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

export async function runCreate(
  opts: CreateOptions
): Promise<ContentOpResult<CreateResult>> {
  try {
    const ws = await createWorkspace({
      cwd: opts.cwd,
      collection: opts.collection,
    });
    const col = ws.getCollection(opts.collection);

    if (!col) {
      if (ws.getSingle(opts.collection)) {
        return {
          success: false,
          error: `Cannot create entries in single "${opts.collection}": singles are key-fixed; edit the file directly.`,
        };
      }
      return {
        success: false,
        error: `Collection not found: ${opts.collection}`,
      };
    }

    if (!col.schema?.meta) {
      return {
        success: false,
        error: `No schema found for collection: ${opts.collection}`,
      };
    }

    // Plan + apply through the writer (single code path for defaults,
    // validation, naming, and serialization).
    const writer = createWriter(
      {
        collections: [
          {
            name: col.name,
            dir: "",
            schema: col.schema.meta,
            extensions: col.config.extensions,
          },
        ],
        i18n: col.config.resolvedI18n,
        adapters: ws.projectConfig.adapters,
      },
      nodeWritableStorage({ root: col.collectionPath })
    );
    const plan = await writer.planCreate(col.name, opts.slug, opts.meta, {
      // No ext: the writer defaults to the first extension with a registered
      // adapter (rather than blindly taking extensions[0], which may be
      // unparseable in adapter-less projects).
      locale: opts.locale,
    });
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
        slug: opts.slug,
        collection: opts.collection,
        file: path.join(col.collectionPath, receipt.file),
        meta: plan.meta,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
