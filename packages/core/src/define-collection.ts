import type { ZodSchema } from "zod";
import type { ContentType, Relations, SchemaModule } from "./types.js";

/**
 * Options for a single-type collection (one schema for all files).
 */
export interface DefineCollectionSingleOptions {
  /** Zod schema for frontmatter / meta validation */
  schema: ZodSchema;
  /**
   * Cross-collection relations: field name → target collection name.
   * Field names are user-defined — any name that matches a field in your schema works.
   * @example `{ glossaryLinks: "glossary", authorRef: "team" }`
   */
  relations?: Relations;
}

/** Schema plus optional filename pattern for multi-type; first matching pattern wins. */
export interface SchemaWithPattern {
  schema: ZodSchema;
  pattern: RegExp;
}

/**
 * Options for a multi-type collection (different schemas by filename pattern).
 * Each entry in schemas can be a plain ZodSchema (no pattern; config.types required for routing)
 * or { schema, pattern } to define routing in this file (single source of truth).
 */
export interface DefineCollectionMultiOptions {
  /**
   * Named schemas; each key becomes export `{key}Meta` (e.g. "term" → termMeta).
   * Value can be a ZodSchema (then use config.types in config.ts for patterns)
   * or { schema, pattern } to define the filename pattern here and export types.
   */
  schemas: Record<string, ZodSchema | SchemaWithPattern>;
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
 * Returns a SchemaModule-compatible object: meta and relations.
 * @example
 * export const { meta, relations } = defineCollection({ schema: z.object({...}), relations: { relatedFaqs: "faq" } });
 */
export function defineCollection(
  options: DefineCollectionSingleOptions
): SchemaModule & { meta: ZodSchema; relations?: Relations };

export function defineCollection(
  options: DefineCollectionSingleOptions | DefineCollectionMultiOptions
): SchemaModule &
  ({ meta: ZodSchema; relations?: Relations } | Record<string, ZodSchema | Relations | undefined>) {
  if ("schema" in options) {
    const { schema, relations } = options;
    const out: SchemaModule & Record<string, unknown> = {
      meta: schema,
    };
    if (relations && Object.keys(relations).length > 0) {
      out.relations = relations;
    }
    return out as unknown as SchemaModule & {
      meta: ZodSchema;
      relations?: Relations;
    };
  }

  const { schemas, relations } = options;
  const result: SchemaModule & Record<string, unknown> = {};
  const types: ContentType[] = [];
  let first: ZodSchema | undefined;

  for (const [name, value] of Object.entries(schemas)) {
    const schema =
      typeof value === "object" && value !== null && "schema" in value
        ? (value as SchemaWithPattern).schema
        : (value as ZodSchema);
    const pattern =
      typeof value === "object" && value !== null && "pattern" in value
        ? (value as SchemaWithPattern).pattern
        : undefined;

    const exportKey = `${name}Meta`;
    result[exportKey] = schema;
    if (first === undefined) first = schema;
    if (pattern) types.push({ name, pattern });
  }

  if (first) result.meta = first;
  if (relations && Object.keys(relations).length > 0) {
    result.relations = relations;
  }
  if (types.length > 0) result.types = types;

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
