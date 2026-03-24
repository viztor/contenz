import type { z } from "zod";

export type SchemaFieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "array"
  | "object"
  | "enum"
  | "union"
  | "any"
  | "unknown";

export interface IntrospectedField {
  type: SchemaFieldType;
  required: boolean;
  description?: string;
  default?: unknown;
  /** Inner type if array */
  itemType?: IntrospectedField;
  /** Schema fields if object */
  shape?: Record<string, IntrospectedField>;
  /** Allowed values if enum or union of literals */
  options?: string[] | number[];
}

export interface IntrospectedSchema {
  fields: Record<string, IntrospectedField>;
  descriptions?: Record<string, string>;
}

/**
 * Access the internal `_def` of a Zod schema.
 *
 * Zod 3.25 (the v3 compat layer of the Zod 4 package) no longer publicly
 * exposes `_def` properties in its types, but they still exist at runtime.
 * We use `any` to access them.
 *
 * Key differences from old Zod 3:
 * - `_def.type` is the lowercase type name ("string", "object", "optional", "pipe", etc.)
 * - NOT `_def.typeName` like old Zod 3 ("ZodString", "ZodObject", etc.)
 * - `_def.shape` is a plain object, NOT a function
 * - `.describe()` stores on `schema.description`, NOT `_def.description`
 * - `.refine()` / `.superRefine()` does NOT wrap in ZodEffects; it stays
 *   as the base type and adds to `_def.checks`
 * - `.transform()` creates a pipe (`_def.type === "pipe"`) with `_def.in` / `_def.out`
 */
// biome-ignore lint/suspicious/noExplicitAny: introspection accesses Zod internals
function getDef(schema: z.ZodTypeAny): any {
  // biome-ignore lint/suspicious/noExplicitAny: Zod internals
  return (schema as any)._def;
}

/**
 * Get the description from a Zod schema.
 * Zod 3.25 stores description on schema.description, not _def.description.
 */
function getDescription(schema: z.ZodTypeAny): string | undefined {
  // biome-ignore lint/suspicious/noExplicitAny: accessing description property
  const direct = (schema as any).description;
  if (typeof direct === "string") return direct;
  const def = getDef(schema);
  return def?.description;
}

/**
 * Get the type name from a Zod schema's _def.
 * Zod 3.25: _def.type is a lowercase string ("string", "object", "optional", etc.)
 * Old Zod 3: _def.typeName is a PascalCase string ("ZodString", "ZodObject", etc.)
 */
function getTypeName(schema: z.ZodTypeAny): string | undefined {
  const def = getDef(schema);
  if (!def) return undefined;
  // Zod 3.25 uses _def.type as a lowercase string
  if (typeof def.type === "string") return def.type;
  // Old Zod 3 uses _def.typeName
  return def.typeName;
}

/**
 * Get the shape of a ZodObject.
 * Zod 3.25: _def.shape is a plain object.
 * Old Zod 3: _def.shape is a function () => Record<string, ZodTypeAny>.
 */
function getShape(schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> {
  const def = getDef(schema);
  const shape = def.shape;
  return typeof shape === "function" ? shape() : shape;
}

/**
 * Get the inner/unwrapped type from optional/nullable/default wrappers.
 * Zod 3.25: uses _def.innerType for optional/nullable, _def.defaultValue on the same _def.
 * Old Zod 3: same.
 * For pipes (transforms): uses _def.in for the input schema.
 * For effects: uses _def.schema.
 */
function getInnerType(schema: z.ZodTypeAny): z.ZodTypeAny | null {
  const def = getDef(schema);
  // Zod 3.25 pipe (transform): _def.in
  if (def.in) return def.in;
  // Standard wrappers: innerType
  if (def.innerType) return def.innerType;
  // Old Zod 3 effects: schema
  if (def.schema) return def.schema;
  // Couldn't unwrap
  return null;
}

/**
 * Check if a type matches a given name.
 * Handles both Zod 3.25 lowercase names and old Zod 3 PascalCase names.
 */
function isTypeMatch(typeName: string | undefined, ...names: string[]): boolean {
  if (!typeName) return false;
  return names.includes(typeName);
}

/**
 * Extracts structural metadata from a Zod schema without validating data.
 *
 * @param schema A ZodObject schema (possibly wrapped in effects/pipe)
 * @param descriptions Optional map of field name to description
 */
export function introspectSchema(
  schema: z.ZodTypeAny,
  descriptions?: Record<string, string>
): IntrospectedSchema {
  const fields: Record<string, IntrospectedField> = {};

  // Unwrap effects/pipe wrappers at the object level
  let baseSchema = schema;
  let typeName = getTypeName(baseSchema);
  const seen = new Set<z.ZodTypeAny>();
  while (
    isTypeMatch(typeName, "ZodEffects", "effects", "pipe", "ZodPipeline") &&
    !seen.has(baseSchema)
  ) {
    seen.add(baseSchema);
    const next = getInnerType(baseSchema);
    if (!next || next === baseSchema) break;
    baseSchema = next;
    typeName = getTypeName(baseSchema);
  }

  if (isTypeMatch(typeName, "ZodObject", "object")) {
    const shape = getShape(baseSchema);
    for (const [key, fieldSchema] of Object.entries(shape)) {
      fields[key] = introspectField(fieldSchema as z.ZodTypeAny);
      if (descriptions?.[key]) {
        fields[key].description = descriptions[key];
      }
    }
  }

  return { fields, descriptions };
}

/**
 * Recursively introspects a single Zod field.
 */
export function introspectField(schema: z.ZodTypeAny): IntrospectedField {
  let isRequired = true;
  let defaultValue: unknown;
  let description = getDescription(schema);

  let inner = schema;
  let typeName = getTypeName(inner);

  // Unwrap Optional / Nullable / Default wrappers
  const seen = new Set<z.ZodTypeAny>();
  while (!seen.has(inner)) {
    if (isTypeMatch(typeName, "ZodOptional", "optional", "ZodNullable", "nullable")) {
      seen.add(inner);
      isRequired = false;
      if (!description) description = getDescription(inner);
      const next = getInnerType(inner);
      if (!next || next === inner) break;
      inner = next;
      typeName = getTypeName(inner);
      continue;
    }
    if (isTypeMatch(typeName, "ZodDefault", "default")) {
      seen.add(inner);
      const def = getDef(inner);
      const defVal = def.defaultValue;
      defaultValue = typeof defVal === "function" ? defVal() : defVal;
      isRequired = false;
      if (!description) description = getDescription(inner);
      const next = getInnerType(inner);
      if (!next || next === inner) break;
      inner = next;
      typeName = getTypeName(inner);
      continue;
    }
    break;
  }

  // Unwrap Effects / Pipe wrappers at field level
  seen.clear();
  while (!seen.has(inner)) {
    if (isTypeMatch(typeName, "ZodEffects", "effects", "pipe", "ZodPipeline")) {
      seen.add(inner);
      if (!description) description = getDescription(inner);
      const next = getInnerType(inner);
      if (!next || next === inner) break;
      inner = next;
      typeName = getTypeName(inner);
      continue;
    }
    break;
  }

  // Pick up description from the innermost schema if not found yet
  if (!description) description = getDescription(inner);

  const baseField: IntrospectedField = {
    type: "unknown",
    required: isRequired,
    ...(description ? { description } : {}),
    ...(defaultValue !== undefined ? { default: defaultValue } : {}),
  };

  // Match type names (both Zod 3.25 lowercase and old Zod 3 PascalCase)
  if (isTypeMatch(typeName, "ZodString", "string")) {
    return { ...baseField, type: "string" };
  }
  if (isTypeMatch(typeName, "ZodNumber", "number")) {
    return { ...baseField, type: "number" };
  }
  if (isTypeMatch(typeName, "ZodBoolean", "boolean")) {
    return { ...baseField, type: "boolean" };
  }
  if (isTypeMatch(typeName, "ZodDate", "date")) {
    return { ...baseField, type: "date" };
  }
  if (isTypeMatch(typeName, "ZodEnum", "enum")) {
    const def = getDef(inner);
    // Zod 3.25: _def.entries (object { key: value }) — use values for both enum/nativeEnum
    // Old Zod 3: _def.values (array of strings)
    const entries = def.entries;
    const values = def.values;
    if (Array.isArray(values)) {
      return { ...baseField, type: "enum", options: values };
    }
    if (entries && typeof entries === "object") {
      return {
        ...baseField,
        type: "enum",
        options: Object.values(entries) as string[],
      };
    }
    return { ...baseField, type: "enum" };
  }
  if (isTypeMatch(typeName, "ZodNativeEnum", "nativeEnum")) {
    const def = getDef(inner);
    const values = def.values || def.entries;
    if (values && typeof values === "object") {
      const enumValues = Object.values(values).filter(
        (v) => typeof v === "string" || typeof v === "number"
      );
      return { ...baseField, type: "enum", options: enumValues as string[] | number[] };
    }
    return { ...baseField, type: "enum" };
  }
  if (isTypeMatch(typeName, "ZodArray", "array")) {
    const def = getDef(inner);
    // Zod 3.25: _def.element; Old Zod 3: _def.type (the element schema)
    const elementType = def.element || def.type;
    if (elementType) {
      return { ...baseField, type: "array", itemType: introspectField(elementType) };
    }
    return { ...baseField, type: "array" };
  }
  if (isTypeMatch(typeName, "ZodObject", "object")) {
    const shape: Record<string, IntrospectedField> = {};
    const objectShape = getShape(inner);
    for (const [key, val] of Object.entries(objectShape)) {
      shape[key] = introspectField(val as z.ZodTypeAny);
    }
    return { ...baseField, type: "object", shape };
  }
  if (isTypeMatch(typeName, "ZodLiteral", "literal")) {
    const def = getDef(inner);
    const value = def.value ?? (def.values ? [...def.values][0] : undefined);
    return { ...baseField, type: "enum", options: value !== undefined ? [value] : [] };
  }
  if (isTypeMatch(typeName, "ZodUnion", "union")) {
    const def = getDef(inner);
    const options = def.options;
    if (Array.isArray(options)) {
      const allLiterals = options.every((opt: z.ZodTypeAny) => {
        const tn = getTypeName(opt);
        return isTypeMatch(tn, "ZodLiteral", "literal");
      });
      if (allLiterals) {
        return {
          ...baseField,
          type: "enum",
          options: options.map((opt: z.ZodTypeAny) => {
            const optDef = getDef(opt);
            return optDef.value ?? (optDef.values ? [...optDef.values][0] : undefined);
          }),
        };
      }
    }
    return { ...baseField, type: "union" };
  }
  if (isTypeMatch(typeName, "ZodAny", "any")) {
    return { ...baseField, type: "any" };
  }

  return baseField;
}
