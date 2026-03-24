/**
 * Programmatic API for schema introspection.
 * Exposes collection schema metadata (fields, types, descriptions) via the CLI.
 */

import { type IntrospectedSchema, introspectSchema } from "./introspect.js";
import type { ContentOpResult } from "./run-content-ops.js";
import { createWorkspace } from "./workspace.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface SchemaOptions {
  cwd: string;
  /** Collection to introspect */
  collection: string;
  /** Content type name (for multi-type collections) */
  contentType?: string;
}

export interface SchemaResultData {
  collection: string;
  contentType: string | null;
  schema: IntrospectedSchema;
  relations: Record<string, string> | null;
}

// ── Implementation ──────────────────────────────────────────────────────────

export async function runSchema(opts: SchemaOptions): Promise<ContentOpResult<SchemaResultData>> {
  try {
    const ws = await createWorkspace({ cwd: opts.cwd, collection: opts.collection });
    const col = ws.getCollection(opts.collection);

    if (!col) {
      return { success: false, error: `Collection not found: ${opts.collection}` };
    }

    if (!col.schema) {
      return { success: false, error: `No schema found for collection: ${opts.collection}` };
    }

    // Determine which schema to introspect
    let targetSchema = col.schema.meta;
    let contentType: string | null = null;

    if (opts.contentType) {
      const key = `${opts.contentType}Meta` as `${string}Meta`;
      const typed = col.schema[key];
      if (!typed) {
        return {
          success: false,
          error: `Content type "${opts.contentType}" not found in collection "${opts.collection}". Available types: ${
            Object.keys(col.schema)
              .filter((k) => k.endsWith("Meta") && k !== "meta")
              .map((k) => k.replace(/Meta$/, ""))
              .join(", ") || "(single-type collection)"
          }`,
        };
      }
      targetSchema = typed;
      contentType = opts.contentType;
    }

    if (!targetSchema) {
      return { success: false, error: `No schema found for collection: ${opts.collection}` };
    }

    const introspected = introspectSchema(targetSchema);
    const relations = col.schema.relations ?? null;

    return {
      success: true,
      data: {
        collection: opts.collection,
        contentType,
        schema: introspected,
        relations: relations as Record<string, string> | null,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
