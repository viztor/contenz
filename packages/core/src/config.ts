import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
  CollectionConfig,
  ConfigModule,
  ContenzConfig,
  Relations,
  ResolvedConfig,
  SchemaModule,
} from "./types.js";

const BUILT_IN_DEFAULTS: Required<Omit<ContenzConfig, "coveragePath" | "outputDir">> & {
  coveragePath: string;
  outputDir: string;
} = {
  contentDir: "content",
  outputDir: "generated/content",
  coveragePath: "contenz.coverage.md",
  strict: false,
  i18n: false,
  extensions: ["md", "mdx"],
  ignore: ["README.md", "_*"],
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
      await fs.access(configPath);
      const imported = await import(pathToFileURL(configPath).href);
      return imported.config ?? {};
    } catch {}
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
    await fs.access(configPath);
    const imported: ConfigModule = await import(pathToFileURL(configPath).href);
    return imported.config;
  } catch {
    return undefined;
  }
}

/**
 * Load schema module from the configured content directory.
 */
export async function loadSchemaModule(collectionPath: string): Promise<SchemaModule | null> {
  const schemaPath = path.join(collectionPath, "schema.ts");
  try {
    await fs.access(schemaPath);
    const imported = await import(pathToFileURL(schemaPath).href);
    return imported;
  } catch {
    return null;
  }
}

/**
 * Load source-level defaults from the configured content directory.
 */
export async function loadContentDefaults(
  contentDir: string
): Promise<{ schema: SchemaModule | null; config: CollectionConfig | undefined }> {
  const schema = await loadSchemaModule(contentDir);
  const config = await loadCollectionConfig(contentDir);
  return { schema, config };
}

/**
 * Resolve configuration by merging all levels:
 * Built-in defaults → contenz config → Content defaults → Collection config
 */
export function resolveConfig(
  project: ContenzConfig,
  contentDefault?: CollectionConfig,
  collection?: CollectionConfig
): ResolvedConfig {
  const contentDir = project.contentDir ?? BUILT_IN_DEFAULTS.contentDir;
  const outputDir = project.outputDir ?? BUILT_IN_DEFAULTS.outputDir;

  return {
    contentDir,
    outputDir,
    coveragePath: project.coveragePath ?? BUILT_IN_DEFAULTS.coveragePath,
    strict: project.strict ?? BUILT_IN_DEFAULTS.strict,
    i18n: collection?.i18n ?? contentDefault?.i18n ?? project.i18n ?? BUILT_IN_DEFAULTS.i18n,
    extensions:
      collection?.extensions ??
      contentDefault?.extensions ??
      project.extensions ??
      BUILT_IN_DEFAULTS.extensions,
    ignore:
      collection?.ignore ?? contentDefault?.ignore ?? project.ignore ?? BUILT_IN_DEFAULTS.ignore,
    types: collection?.types ?? contentDefault?.types,
    slugPattern: collection?.slugPattern ?? contentDefault?.slugPattern,
  };
}

/**
 * Extract relations from schema module.
 * If no explicit relations export, auto-detect from field names matching `related{Collection}` pattern.
 */
export function extractRelations(
  schemaModule: SchemaModule,
  availableCollections: string[]
): Relations {
  // Use explicit relations if provided
  if (schemaModule.relations) {
    return schemaModule.relations;
  }

  // Auto-detect from schema fields
  const relations: Relations = {};
  const schema = schemaModule.meta;

  if (schema && "_def" in schema) {
    const def = schema._def as { shape?: () => Record<string, unknown> };
    if (typeof def.shape === "function") {
      const shape = def.shape();
      for (const fieldName of Object.keys(shape)) {
        // Match pattern: related{Collection} → collection
        const match = fieldName.match(/^related([A-Z][a-zA-Z]*)$/);
        if (match) {
          const targetCollection = match[1].toLowerCase();
          // Only add if target collection exists
          if (availableCollections.includes(targetCollection)) {
            relations[fieldName] = targetCollection;
          }
        }
      }
    }
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
  const schemaKey = `${typeName}Meta` as `${string}Meta`;
  return schemaModule[schemaKey] ?? schemaModule.meta;
}

/**
 * Determine content type from filename using config.types patterns.
 */
export function getContentType(fileName: string, config: ResolvedConfig): string | undefined {
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
