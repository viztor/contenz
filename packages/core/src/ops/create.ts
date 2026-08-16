import { writeContent } from "../content-io.js";
import { introspectSchema } from "../introspect.js";
import type { ContentExtension } from "../parser.js";
import { validateMeta } from "../validator.js";
import { createWorkspace } from "../workspace.js";
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

    // Fill defaults from schema introspection
    const meta = { ...opts.meta };
    const introspected = introspectSchema(col.schema.meta);
    for (const [fieldName, field] of Object.entries(introspected.fields)) {
      if (meta[fieldName] === undefined && field.default !== undefined) {
        meta[fieldName] = field.default;
      }
    }

    // Validate against schema
    const validation = validateMeta(
      meta,
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

    const location = await writeContent({
      cwd: opts.cwd,
      collectionName: opts.collection,
      slug: opts.slug,
      locale: opts.locale,
      meta,
      ext: col.config.extensions[0] ?? "mdx",
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
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
