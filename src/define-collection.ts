import type { ZodSchema } from "zod";
import type { Relations, SchemaModule } from "./types.js";

/**
 * Options for a single-type collection (one schema for all files).
 */
export interface DefineCollectionSingleOptions {
  /** Zod schema for frontmatter / meta validation */
  schema: ZodSchema;
  /** Cross-collection relations: field name → target collection name */
  relations?: Relations;
}

/**
 * Options for a multi-type collection (different schemas by filename pattern).
 */
export interface DefineCollectionMultiOptions {
  /** Named schemas; each key becomes export `{key}Meta` (e.g. "term" → termMeta) */
  schemas: Record<string, ZodSchema>;
  /** Cross-collection relations: field name → target collection name */
  relations?: Relations;
}

/**
 * Define a multi-type content collection with named schemas and optional relations.
 * Returns a SchemaModule-compatible object: for each key "term" in schemas, exports termMeta; also meta and relations.
 * @example
 * export const { termMeta, topicMeta, meta, relations } = defineCollection({ schemas: { term: ..., topic: ... }, relations: {...} });
 */
export function defineCollection(
  options: DefineCollectionMultiOptions
): SchemaModule & Record<string, ZodSchema | Relations | undefined>;

/**
 * Define a single-type content collection with one schema and optional relations.
 * Returns a SchemaModule-compatible object: meta, metaSchema, and relations.
 * @example
 * export const { meta, metaSchema, relations } = defineCollection({ schema: z.object({...}), relations: { relatedFaqs: "faq" } });
 */
export function defineCollection(
  options: DefineCollectionSingleOptions
): SchemaModule & { meta: ZodSchema; metaSchema: ZodSchema; relations?: Relations };

export function defineCollection(
  options: DefineCollectionSingleOptions | DefineCollectionMultiOptions
): SchemaModule &
  (
    | { meta: ZodSchema; metaSchema: ZodSchema; relations?: Relations }
    | Record<string, ZodSchema | Relations | undefined>
  ) {
  if ("schema" in options) {
    const { schema, relations } = options;
    const out: SchemaModule & Record<string, unknown> = {
      meta: schema,
      metaSchema: schema,
    };
    if (relations && Object.keys(relations).length > 0) {
      out.relations = relations;
    }
    return out as unknown as SchemaModule & {
      meta: ZodSchema;
      metaSchema: ZodSchema;
      relations?: Relations;
    };
  }

  const { schemas, relations } = options;
  const result: SchemaModule & Record<string, unknown> = {};
  let first: ZodSchema | undefined;
  for (const [name, schema] of Object.entries(schemas)) {
    const exportKey = `${name}Meta`;
    result[exportKey] = schema;
    if (first === undefined) first = schema;
  }
  if (first) result.meta = first;
  if (relations && Object.keys(relations).length > 0) {
    result.relations = relations;
  }
  return result as unknown as SchemaModule & Record<string, ZodSchema | Relations | undefined>;
}

/**
 * Define a multi-type content collection (alias for defineCollection with schemas).
 * Use this when you have multiple content types in one collection to avoid overload ambiguity.
 */
export function defineMultiTypeCollection(
  options: DefineCollectionMultiOptions
): SchemaModule & Record<string, ZodSchema | Relations | undefined> {
  return defineCollection(options);
}
