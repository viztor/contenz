import path from "node:path";
import { pathToFileURL } from "node:url";

import { buildAdapterList } from "./format-adapter.js";
import { normalizeI18nConfig } from "./i18n.js";
import { getZodShape, isZodObject } from "./introspect.js";
import { resolveSourcePatterns } from "./sources.js";
import type {
  CollectionConfig,
  ConfigModule,
  ContenzConfig,
  Relations,
  ResolvedConfig,
  SchemaModule,
} from "./types.js";

const BUILT_IN_DEFAULTS: Required<
  Omit<
    ContenzConfig,
    "coveragePath" | "outputDir" | "contentDir" | "collections"
  >
> & {
  coveragePath: string;
  outputDir: string;
} = {
  sources: ["content/*"],
  outputDir: "generated/content",
  coveragePath: "contenz.coverage.md",
  strict: false,
  i18n: false,
  extensions: ["md", "mdx", "json"],
  ignore: ["README.md", "_*"],
  adapters: [],
  hooks: {},
  buildSearchIndex: true,
};

const CONFIG_FILENAMES = [
  "contenz.config.ts",
  "contenz.config.mjs",
  "contenz.config.js",
  "content.config.ts",
  "content.config.mjs",
  "content.config.js",
] as const;

/**
 * Load contenz config from contenz.config.ts (or .mjs / .js if not found).
 * Legacy content.config.* files are also supported as a fallback.
 */
export async function loadProjectConfig(cwd: string): Promise<ContenzConfig> {
  for (const filename of CONFIG_FILENAMES) {
    const configPath = path.join(cwd, filename);
    try {
      const imported = await import(pathToFileURL(configPath).href);
      return imported.config ?? {};
    } catch (err) {
      // File not found — try next candidate
      if (isModuleNotFoundError(err, configPath)) continue;
      // File exists but failed to load — surface the error
      throw new Error(
        `Failed to load project config "${filename}": ${err instanceof Error ? err.message : err}`,
        { cause: err }
      );
    }
  }
  return {};
}

/**
 * Load collection config from the configured content directory.
 */
export async function loadCollectionConfig(
  collectionPath: string
): Promise<CollectionConfig | undefined> {
  const configPath = path.join(collectionPath, "config.ts");
  try {
    const imported: ConfigModule = await import(pathToFileURL(configPath).href);
    return imported.config;
  } catch (err) {
    if (isModuleNotFoundError(err, configPath)) return undefined;
    throw new Error(
      `Failed to load collection config "${configPath}": ${err instanceof Error ? err.message : err}`,
      { cause: err }
    );
  }
}

/**
 * Load schema module from the configured content directory.
 */
export async function loadSchemaModule(
  collectionPath: string
): Promise<SchemaModule | null> {
  const schemaPath = path.join(collectionPath, "schema.ts");
  try {
    const imported = await import(pathToFileURL(schemaPath).href);
    return imported;
  } catch (err) {
    if (isModuleNotFoundError(err, schemaPath)) return null;
    throw new Error(
      `Failed to load schema "${schemaPath}": ${err instanceof Error ? err.message : err}`,
      { cause: err }
    );
  }
}

/**
 * Check if an import error is a "module not found" error for the given path.
 * Distinguishes missing files from syntax/runtime errors in existing files.
 */
function isModuleNotFoundError(err: unknown, filePath: string): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as NodeJS.ErrnoException).code;
  // Node ESM: ERR_MODULE_NOT_FOUND; CJS: MODULE_NOT_FOUND
  if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") {
    // Only treat as "not found" if the error is about our file, not a dependency
    const fileUrl = pathToFileURL(filePath).href;
    return err.message.includes(fileUrl) || err.message.includes(filePath);
  }
  return false;
}

/**
 * Resolve configuration by merging all levels:
 * Built-in defaults → contenz config → Collection config
 */
export function resolveConfig(
  project: ContenzConfig,
  collection?: CollectionConfig
): ResolvedConfig {
  const outputDir = project.outputDir ?? BUILT_IN_DEFAULTS.outputDir;
  const rawI18n = collection?.i18n ?? project.i18n ?? BUILT_IN_DEFAULTS.i18n;
  const resolvedI18n = normalizeI18nConfig(rawI18n);

  return {
    sources: resolveSourcePatterns(project),
    outputDir,
    coveragePath: project.coveragePath ?? BUILT_IN_DEFAULTS.coveragePath,
    strict: project.strict ?? BUILT_IN_DEFAULTS.strict,
    i18n: resolvedI18n.enabled,
    resolvedI18n,
    adapters: buildAdapterList(project.adapters),
    extensions:
      collection?.extensions ??
      project.extensions ??
      BUILT_IN_DEFAULTS.extensions,
    ignore: collection?.ignore ?? project.ignore ?? BUILT_IN_DEFAULTS.ignore,
    buildSearchIndex:
      project.buildSearchIndex ?? BUILT_IN_DEFAULTS.buildSearchIndex,
    types: collection?.types,
    slugPattern: collection?.slugPattern,
  };
}

/**
 * Extract relations from schema module.
 * If explicit relations are provided via `defineCollection({ relations })`, returns those.
 * Otherwise, falls back to auto-detecting from field names matching `related{Collection}`.
 *
 * @deprecated The auto-detection fallback is deprecated. Use explicit `relations` in
 * `defineCollection()` instead. Auto-detection will be removed in a future major version.
 *
 * @example
 * ```ts
 * // Preferred: explicit relations with any field name
 * export const { meta, relations } = defineCollection({
 *   schema,
 *   relations: {
 *     glossaryLinks: "glossary",   // custom field name
 *     authorRef: "team",           // any name works
 *   },
 * });
 * ```
 */
export function extractRelations(
  schemaModule: SchemaModule,
  availableCollections: string[]
): Relations {
  // Use explicit relations if provided
  if (schemaModule.relations) {
    return schemaModule.relations;
  }

  // Auto-detect from schema fields (DEPRECATED)
  const relations: Relations = {};
  const schema = schemaModule.meta;

  if (schema && isZodObject(schema)) {
    const shape = getZodShape(schema);
    for (const fieldName of Object.keys(shape)) {
      // Match pattern: related{Collection} → collection
      const match = /^related([A-Z][a-zA-Z]*)$/.exec(fieldName);
      if (match) {
        const targetCollection = match[1].toLowerCase();
        // Only add if target collection exists
        if (availableCollections.includes(targetCollection)) {
          relations[fieldName] = targetCollection;
        }
      }
    }
  }

  if (Object.keys(relations).length > 0) {
    console.warn(
      `[contenz] Deprecation: Auto-detected relations ${JSON.stringify(relations)} from schema field names. ` +
        `Please use explicit \`relations\` in defineCollection() instead. ` +
        `Auto-detection of \`related{Collection}\` fields will be removed in a future major version.`
    );
  }

  return relations;
}

/**
 * Get the schema for a specific content type.
 * For single-type collections, returns `meta`.
 * For multi-type collections, returns `{typeName}Meta`.
 */
export function getSchemaForType(
  schemaModule: SchemaModule,
  typeName?: string
): import("zod").ZodSchema | undefined {
  if (!typeName || typeName === "default") {
    return schemaModule.meta;
  }
  // Multi-type schemas export `${typeName}Meta`; index via a string map.
  const schemas = schemaModule as SchemaModule &
    Record<string, import("zod").ZodSchema | undefined>;
  return schemas[`${typeName}Meta`] ?? schemaModule.meta;
}

/**
 * Determine content type from filename using config.types patterns.
 */
export function getContentType(
  fileName: string,
  config: ResolvedConfig
): string | undefined {
  if (!config.types || config.types.length === 0) {
    return undefined;
  }

  for (const type of config.types) {
    if (type.pattern.test(fileName)) {
      return type.name;
    }
  }

  return undefined;
}
