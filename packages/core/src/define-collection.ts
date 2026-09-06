import type { ZodSchema } from "zod";

import type { ContentType, Relations, SchemaModule } from "./types.js";

/** Computed field functions keyed by output field name. */
export type ComputedFields = Record<
  string,
  (item: import("./types.js").ParsedContent) => unknown | Promise<unknown>
>;

/**
 * Options for a single-type collection (one schema for all files).
 */
export interface DefineCollectionSingleOptions {
  /** Zod schema for frontmatter / meta validation */
  schema: ZodSchema;
  /**
   * Override the generated meta interface name.
   * Default: PascalCase collection directory name + "Meta" (e.g. `faq` → `FaqMeta`).
   */
  metaTypeName?: string;
  /**
   * Cross-collection relations: field name → target collection name.
   * Field names are user-defined — any name that matches a field in your schema works.
   * @example `{ glossaryLinks: "glossary", authorRef: "team" }`
   */
  relations?: Relations;
  /** Computed fields derived from raw content or metadata */
  computed?: ComputedFields;
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
  /**
   * Cross-collection relations: field name → target collection name.
   */
  relations?: Relations;
  /** Computed fields derived from raw content or metadata */
  computed?: ComputedFields;
}

/** Map each multi-type key to its `{name}Meta` export name for typed destructuring. */
export type MultiTypeExports<S extends Record<string, unknown>> = {
  [K in keyof S & string as `${K}Meta`]: ZodSchema;
};

export function defineCollection(
  options: DefineCollectionMultiOptions
): SchemaModule & Record<string, ZodSchema | Relations | undefined>;

export function defineCollection(
  options: DefineCollectionSingleOptions
): SchemaModule & {
  meta: ZodSchema;
  relations?: Relations;
  computed?: ComputedFields;
  metaTypeName?: string;
};

export function defineCollection(
  options: DefineCollectionSingleOptions | DefineCollectionMultiOptions
):
  | (SchemaModule & {
      meta: ZodSchema;
      relations?: Relations;
      computed?: ComputedFields;
      metaTypeName?: string;
    })
  | (SchemaModule & Record<string, ZodSchema | Relations | undefined>) {
  if ("schema" in options) {
    const { schema, relations, metaTypeName } = options;
    const out: SchemaModule & Record<string, unknown> = {
      meta: schema,
    };
    if (metaTypeName) out.metaTypeName = metaTypeName;
    if (relations && Object.keys(relations).length > 0) {
      out.relations = relations;
    }
    if (options.computed && Object.keys(options.computed).length > 0) {
      out.computed = options.computed;
    }
    return out as SchemaModule & {
      meta: ZodSchema;
      relations?: Relations;
      computed?: ComputedFields;
      metaTypeName?: string;
    };
  }

  const { schemas, relations } = options;
  if (Object.keys(schemas).length === 0) {
    throw new Error(
      "defineCollection(): `schemas` must declare at least one content type."
    );
  }

  const result: SchemaModule & Record<string, unknown> = {};
  const types: ContentType[] = [];
  let first: ZodSchema | undefined;

  for (const [name, value] of Object.entries(schemas)) {
    const schema =
      typeof value === "object" && value !== null && "schema" in value
        ? value.schema
        : value;
    const pattern =
      typeof value === "object" && value !== null && "pattern" in value
        ? value.pattern
        : undefined;

    const exportKey = `${name}Meta`;
    result[exportKey] = schema;
    if (first === undefined) first = schema;
    if (pattern) {
      const clash = types.find((t) => t.pattern.source === pattern.source);
      if (clash) {
        throw new Error(
          `defineCollection(): duplicate filename pattern /${pattern.source}/ for types "${clash.name}" and "${name}". First match wins, so "${name}" would never match.`
        );
      }
      types.push({ name, pattern });
    }
  }
  if (first !== undefined) result.meta = first;
  if (relations && Object.keys(relations).length > 0) {
    result.relations = relations;
  }
  if (options.computed && Object.keys(options.computed).length > 0) {
    result.computed = options.computed;
  }
  if (types.length > 0) result.types = types;

  return result as SchemaModule &
    Record<string, ZodSchema | Relations | undefined>;
}

/**
 * Define a single (key-addressed single content value, e.g. site settings).
 * Returns the same module shape as a single-type collection so workspace,
 * build, and lint pipelines handle singles uniformly.
 */
export interface DefineSingleOptions {
  /** Zod schema for meta validation */
  schema: ZodSchema;
  /**
   * Override the generated meta interface name.
   * Default: PascalCase single name + "Meta" (e.g. `site` → `SiteMeta`).
   */
  metaTypeName?: string;
  /** Cross-collection relations: field name → target collection (or single) name */
  relations?: Relations;
  /** Computed fields derived from raw content or metadata */
  computed?: ComputedFields;
}

export function defineSingle(options: DefineSingleOptions): SchemaModule & {
  meta: ZodSchema;
  relations?: Relations;
  computed?: ComputedFields;
  metaTypeName?: string;
} {
  return defineCollection(options);
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
