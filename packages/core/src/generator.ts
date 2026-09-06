import fs from "node:fs/promises";

import type { ZodTypeAny } from "zod";

import { type ResolvedI18nConfig, resolveI18nEntry } from "./i18n.js";
import { getZodDef, getZodTypeName } from "./introspect.js";
import type { CollectionStats } from "./types.js";

/**
 * Collection data with i18n support (grouped by slug with locale variants).
 */
export interface I18nCollectionData {
  slug: string;
  locales: Record<string, { file: string; meta: Record<string, unknown> }>;
}

/**
 * Collection data without i18n (flat structure).
 */
export interface FlatCollectionData {
  slug: string;
  file: string;
  meta: Record<string, unknown>;
}

export type CollectionData = I18nCollectionData | FlatCollectionData;

/**
 * Get the Zod type name from a schema (handles both old and new Zod versions).
 */
function schemaTypeName(schema: ZodTypeAny): string | undefined {
  return getZodTypeName(schema);
}

/**
 * Convert a Zod schema to a TypeScript type string.
 */
function zodToTypeString(schema: ZodTypeAny, indent = 0): string {
  const pad = "  ".repeat(indent);
  const def = getZodDef(schema);
  const typeName = schemaTypeName(schema);

  // Handle optional wrapper (new Zod uses "optional", old uses "ZodOptional")
  if (typeName === "optional" || typeName === "ZodOptional") {
    const inner = def.innerType;
    return `${zodToTypeString(inner, indent)} | undefined`;
  }

  // Handle default wrapper (new Zod uses "default", old uses "ZodDefault")
  if (typeName === "default" || typeName === "ZodDefault") {
    const inner = def.innerType;
    return zodToTypeString(inner, indent);
  }

  // Handle primitives
  if (typeName === "string" || typeName === "ZodString") return "string";
  if (typeName === "number" || typeName === "ZodNumber") return "number";
  if (typeName === "boolean" || typeName === "ZodBoolean") return "boolean";
  if (typeName === "null" || typeName === "ZodNull") return "null";
  if (typeName === "undefined" || typeName === "ZodUndefined")
    return "undefined";
  if (typeName === "any" || typeName === "ZodAny") return "unknown";
  if (typeName === "unknown" || typeName === "ZodUnknown") return "unknown";

  // Handle arrays (new Zod uses "array", old uses "ZodArray")
  if (typeName === "array" || typeName === "ZodArray") {
    // New Zod uses def.element, old uses def.type
    const elementType = def.element || def.type;
    const innerType = zodToTypeString(elementType, indent);
    // Wrap complex types in parentheses
    if (innerType.includes("|") || innerType.includes("&")) {
      return `(${innerType})[]`;
    }
    return `${innerType}[]`;
  }

  // Handle enums (new Zod uses "enum", old uses "ZodEnum")
  if (typeName === "enum" || typeName === "ZodEnum") {
    // New Zod uses def.entries, old uses def.values
    const values = def.entries || def.values;
    if (Array.isArray(values)) {
      return values.map((v: string) => `"${v}"`).join(" | ");
    }
    // If entries is an object (enum-like), get keys
    if (typeof values === "object") {
      return Object.keys(values)
        .map((v) => `"${v}"`)
        .join(" | ");
    }
    return "string";
  }

  // Handle literals (new Zod uses "literal", old uses "ZodLiteral")
  if (typeName === "literal" || typeName === "ZodLiteral") {
    const value = def.value;
    if (typeof value === "string") return `"${value}"`;
    if (typeof value === "number" || typeof value === "boolean")
      return String(value);
    return "unknown";
  }

  // Handle unions (new Zod uses "union", old uses "ZodUnion")
  if (typeName === "union" || typeName === "ZodUnion") {
    const options = def.options as ZodTypeAny[];
    return options.map((opt) => zodToTypeString(opt, indent)).join(" | ");
  }

  // Handle objects (new Zod uses "object", old uses "ZodObject")
  if (typeName === "object" || typeName === "ZodObject" || def?.shape) {
    // New Zod stores shape directly, old Zod uses a getter function
    const shapeGetter = def.shape;
    const shape =
      typeof shapeGetter === "function" ? shapeGetter() : shapeGetter;
    if (!shape || typeof shape !== "object") return "{}";

    const entries = Object.entries(shape as Record<string, ZodTypeAny>);
    if (entries.length === 0) return "{}";

    const lines = entries.map(([key, value]) => {
      const valueTypeName = getZodTypeName(value);
      const isOptional =
        valueTypeName === "optional" ||
        valueTypeName === "ZodOptional" ||
        valueTypeName === "default" ||
        valueTypeName === "ZodDefault";
      const fieldType = zodToTypeString(value, indent + 1);
      const optionalMark = isOptional ? "?" : "";
      return `${pad}  ${key}${optionalMark}: ${fieldType};`;
    });

    return `{\n${lines.join("\n")}\n${pad}}`;
  }

  // Fallback for unknown types
  return "unknown";
}

/**
 * Generate a TypeScript interface from a Zod schema.
 */
export function generateTypeFromZod(
  schema: ZodTypeAny,
  typeName: string
): string {
  const typeBody = zodToTypeString(schema, 0);
  return `export interface ${typeName} ${typeBody}`;
}

/**
 * Check if data is i18n format.
 */
export function isI18nData(data: CollectionData): data is I18nCollectionData {
  return "locales" in data;
}

/**
 * Calculate statistics for i18n collection.
 */
export function calculateI18nStats(
  items: I18nCollectionData[]
): CollectionStats & {
  locales: Record<string, number>;
  complete: number;
  coverage: number;
} {
  const total = items.length;
  const locales: Record<string, number> = {};

  for (const item of items) {
    for (const locale of Object.keys(item.locales)) {
      locales[locale] = (locales[locale] ?? 0) + 1;
    }
  }

  const localeKeys = Object.keys(locales);
  const complete = items.filter((item) =>
    localeKeys.every((locale) => item.locales[locale])
  ).length;
  const coverage = total > 0 ? complete / total : 1;

  const missingTranslations = items
    .filter((item) => !localeKeys.every((locale) => item.locales[locale]))
    .map((item) => item.slug);

  return {
    total,
    locales,
    complete,
    coverage: Math.round(coverage * 100) / 100,
    missingTranslations,
  };
}

/**
 * Calculate statistics for flat collection.
 */
export function calculateFlatStats(
  items: FlatCollectionData[]
): CollectionStats {
  return { total: items.length };
}

/**
 * Build the per-slug data object for an i18n collection.
 * Shared by the TypeScript emitter and the JSON emitter so both outputs
 * always carry identical data (fallback-resolved per declared locale).
 */
export function buildI18nDataObject(
  items: I18nCollectionData[],
  locales: string[],
  i18nConfig?: Pick<
    ResolvedI18nConfig,
    "fallbackChains" | "defaultFallbackChain" | "includeFallbackMetadata"
  >
): Record<string, unknown> {
  const includeFallback = i18nConfig?.includeFallbackMetadata === true;
  const dataObj: Record<string, unknown> = {};
  for (const item of items) {
    const itemData: Record<string, unknown> = {
      slug: item.slug,
      locales: {},
    };

    for (const locale of locales) {
      const resolved = resolveI18nEntry(
        item.locales,
        locale,
        i18nConfig ?? {
          fallbackChains: {},
          defaultFallbackChain: [],
        }
      );
      if (resolved) {
        (itemData.locales as Record<string, unknown>)[locale] = {
          slug: item.slug,
          file: resolved.file,
          ...resolved.meta,
          ...(includeFallback && resolved._fallback != null
            ? { _fallback: resolved._fallback }
            : {}),
        };
      }
    }

    dataObj[item.slug] = itemData;
  }
  return dataObj;
}

/**
 * Build the per-slug data object for a flat (non-i18n) collection.
 * Shared by the TypeScript emitter and the JSON emitter.
 */
export function buildFlatDataObject(
  items: FlatCollectionData[]
): Record<string, unknown> {
  const dataObj: Record<string, unknown> = {};
  for (const item of items) {
    dataObj[item.slug] = {
      slug: item.slug,
      file: item.file,
      ...item.meta,
    };
  }
  return dataObj;
}

/**
 * Build the per-slug data object for an i18n collection WITHOUT fallback
 * resolution (raw detected locales only). This is the multi-type emitter's
 * historical behavior, preserved verbatim for output parity.
 */
export function buildRawI18nDataObject(
  items: I18nCollectionData[]
): Record<string, unknown> {
  const dataObj: Record<string, unknown> = {};
  for (const item of items) {
    const itemData: Record<string, unknown> = {
      slug: item.slug,
      locales: {},
    };
    for (const [locale, entry] of Object.entries(item.locales)) {
      (itemData.locales as Record<string, unknown>)[locale] = {
        slug: item.slug,
        file: entry.file,
        ...entry.meta,
      };
    }
    dataObj[item.slug] = itemData;
  }
  return dataObj;
}

/**
 * Build the per-type data maps for a multi-type collection, keyed exactly as
 * the TypeScript emitter names them (`<type>s`).
 */
export function buildMultiTypeDataObject(
  typeGroups: Map<string, Map<string, I18nCollectionData | FlatCollectionData>>,
  i18n: boolean
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [typeName, itemsMap] of typeGroups) {
    if (typeName === "default") continue;
    const items = Array.from(itemsMap.values()).sort((a, b) =>
      a.slug.localeCompare(b.slug)
    );
    out[`${typeName}s`] = i18n
      ? buildRawI18nDataObject(items as I18nCollectionData[])
      : buildFlatDataObject(items as FlatCollectionData[]);
  }
  return out;
}

/**
 * Generate {collection}.ts file for a collection with i18n support.
 * Output goes to generated/content/{collection}.ts
 * When resolvedI18n.includeFallbackMetadata is true, entries may include _fallback when content was resolved from another locale.
 */
export async function generateI18nCollectionFile(
  outputPath: string,
  collectionName: string,
  items: I18nCollectionData[],
  metaTypeName: string,
  locales: string[],
  schema?: ZodTypeAny,
  i18nConfig?: Pick<
    ResolvedI18nConfig,
    "fallbackChains" | "defaultFallbackChain" | "includeFallbackMetadata"
  >
): Promise<void> {
  const stats = calculateI18nStats(items);
  const entryTypeName = metaTypeName.replace("Meta", "Entry");
  const itemTypeName = metaTypeName.replace("Meta", "Item");
  const includeFallback = i18nConfig?.includeFallbackMetadata === true;

  let output = `// Auto-generated by contenz - DO NOT EDIT
// Run: contenz build

`;

  // Generate inline type from Zod schema
  if (schema) {
    output += generateTypeFromZod(schema, metaTypeName);
    output += "\n\n";
  } else {
    output += `export interface ${metaTypeName} {\n  [key: string]: unknown;\n}\n\n`;
  }

  output += `/** ${collectionName} entry with file path and all metadata */
export interface ${entryTypeName} extends ${metaTypeName} {
  slug: string;
  file: string;
  _fallback?: string;
}

/** ${collectionName} item with locale versions */
export interface ${itemTypeName} {
  slug: string;
  locales: {
${locales.map((l) => `    ${l}?: ${entryTypeName};`).join("\n")}
  };
}

// ============================================
// Generated Data
// ============================================

export const ${collectionName}: Record<string, ${itemTypeName}> = `;

  const dataObj = buildI18nDataObject(items, locales, i18nConfig);

  output += JSON.stringify(dataObj, null, 2);
  output += ";\n\n";

  output += `export const ${collectionName}Slugs = Object.keys(${collectionName}) as (keyof typeof ${collectionName})[];\n\n`;
  output += `export const ${collectionName}Stats = ${JSON.stringify(stats, null, 2)};\n`;

  await fs.writeFile(outputPath, output, "utf-8");
}

/**
 * Generate {collection}.ts file for a collection without i18n.
 * Output goes to generated/content/{collection}.ts
 */
export async function generateFlatCollectionFile(
  outputPath: string,
  collectionName: string,
  items: FlatCollectionData[],
  metaTypeName: string,
  schema?: ZodTypeAny
): Promise<void> {
  const stats = calculateFlatStats(items);
  const entryTypeName = metaTypeName.replace("Meta", "Entry");

  let output = `// Auto-generated by contenz - DO NOT EDIT
// Run: contenz build

`;

  // Generate inline type from Zod schema
  if (schema) {
    output += generateTypeFromZod(schema, metaTypeName);
    output += "\n\n";
  } else {
    output += `export interface ${metaTypeName} {\n  [key: string]: unknown;\n}\n\n`;
  }

  output += `/** ${collectionName} entry with file path and all metadata */
export interface ${entryTypeName} extends ${metaTypeName} {
  slug: string;
  file: string;
}

// ============================================
// Generated Data
// ============================================

export const ${collectionName}: Record<string, ${entryTypeName}> = `;

  const dataObj = buildFlatDataObject(items);

  output += JSON.stringify(dataObj, null, 2);
  output += ";\n\n";

  output += `export const ${collectionName}Slugs = Object.keys(${collectionName}) as (keyof typeof ${collectionName})[];\n\n`;
  output += `export const ${collectionName}Stats = ${JSON.stringify(stats, null, 2)};\n`;

  await fs.writeFile(outputPath, output, "utf-8");
}

/**
 * Generate index.ts that re-exports all collections.
 * Output goes to generated/content/index.ts
 */
export async function generateIndexFile(
  outputPath: string,
  collections: {
    name: string;
    types?: string[];
    hasI18n: boolean;
    metaTypeName?: string;
  }[]
): Promise<void> {
  let output = `// Auto-generated by contenz - DO NOT EDIT
// Run: contenz build

`;

  for (const { name, types, hasI18n, metaTypeName } of collections) {
    if (types && types.length > 0) {
      // Multi-type collection
      for (const type of types) {
        const typeName = type.charAt(0).toUpperCase() + type.slice(1);
        output += `export { ${type}s, ${type}sSlugs, ${type}sStats } from "./${name}.js";\n`;
        output += `export type { ${typeName}Meta, ${typeName}Entry, ${typeName}Item } from "./${name}.js";\n`;
      }
    } else {
      // Single-type collection - use actual meta type name from schema
      const baseTypeName =
        metaTypeName?.replace("Meta", "") ??
        name.charAt(0).toUpperCase() + name.slice(1);
      output += `export { ${name}, ${name}Slugs, ${name}Stats } from "./${name}.js";\n`;
      if (hasI18n) {
        output += `export type { ${baseTypeName}Meta, ${baseTypeName}Entry, ${baseTypeName}Item } from "./${name}.js";\n`;
      } else {
        output += `export type { ${baseTypeName}Meta, ${baseTypeName}Entry } from "./${name}.js";\n`;
      }
    }
    output += "\n";
  }

  await fs.writeFile(outputPath, output, "utf-8");
}
