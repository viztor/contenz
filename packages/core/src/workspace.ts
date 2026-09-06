/**
 * Workspace: consolidated project context loaded once and shared across pipelines.
 *
 * Eliminates the repeated config/discovery/schema loading in run-build.ts and run-lint.ts.
 * Each pipeline calls `createWorkspace(cwd, sources?)` once and passes the result around.
 */

import fs from "node:fs/promises";
import path from "node:path";

import {
  loadProjectConfig,
  loadSchemaModule,
  resolveConfig,
} from "./config.js";
import { parseFileName } from "./parser.js";
// format-adapter.ts is no longer imported here for registerAdapters
import {
  type DiscoveredCollection,
  discoverCollections,
  globContentFiles,
  normalizeLegacyContentDir,
} from "./sources.js";
import type {
  CollectionConfig,
  CollectionDeclaration,
  ContenzConfig,
  ResolvedConfig,
  SchemaModule,
} from "./types.js";

/**
 * Pre-loaded context for a single collection.
 * Contains everything a pipeline needs to process content files.
 */
export interface CollectionContext {
  /** Collection name (directory basename) or single name (config key) */
  name: string;
  /** Absolute path to the collection directory (or the single's directory) */
  collectionPath: string;
  /** Discriminator: multi-file collections vs key-addressed singles */
  kind: "collection" | "single";
  /** Merged config (project + collection-level overrides) */
  config: ResolvedConfig;
  /** Collection-level raw config (if present) */
  collectionConfig: CollectionConfig | undefined;
  /** Loaded schema module (null if schema.ts failed to load) */
  schema: SchemaModule | null;
  /** List of content file paths (relative to collectionPath) */
  contentFiles: string[];
}

/**
 * Project-wide workspace context.
 * Loads all config, discovers all collections, and makes them available.
 */
export interface Workspace {
  /** Resolved working directory */
  cwd: string;
  /** Raw project config from contenz.config.ts */
  projectConfig: ContenzConfig;
  /** Resolved config (project-level, before collection overrides) */
  resolvedConfig: ResolvedConfig;
  /** Resolved source patterns */
  sources: string[];
  /** All discovered and loaded collections (kind "collection") */
  collections: CollectionContext[];
  /** All declared and loaded singles (kind "single") */
  singles: CollectionContext[];
  /** Errors encountered during collection discovery */
  discoveryErrors: string[];

  /** Get a collection context by name */
  getCollection(name: string): CollectionContext | undefined;
  /** Get a single context by name */
  getSingle(name: string): CollectionContext | undefined;
}

export interface CreateWorkspaceOptions {
  /** Working directory */
  cwd: string;
  /** Override source patterns (ignores config sources) */
  sources?: string[];
  /** @deprecated Use `sources` instead */
  dir?: string;
  /** Only load this specific collection */
  collection?: string;
}

/**
 * Create a Workspace by loading all project config, discovering collections,
 * and pre-loading each collection's config, schema, and content file list.
 *
 * Throws on critical config errors. Discovery errors are captured non-fatally
 * in `workspace.discoveryErrors`.
 */
export async function createWorkspace(
  options: CreateWorkspaceOptions
): Promise<Workspace> {
  const cwd = options.cwd;
  const projectConfig = await loadProjectConfig(cwd);
  const resolvedConfig = resolveConfig(projectConfig);

  // Adapters are now resolved directly into projectConfig and passed through resolvedConfig

  const sources =
    options.sources ??
    (options.dir
      ? [normalizeLegacyContentDir(options.dir)]
      : resolvedConfig.sources);

  const discovery = await discoverCollections(cwd, sources);
  let discoveredCollections = discovery.collections;

  // Filter to single collection if requested (matches collections or singles)
  if (options.collection) {
    discoveredCollections = discoveredCollections.filter(
      (c) => c.name === options.collection
    );
  }

  // Load each discovered collection's schema and content file list.
  // There is exactly one config file per project: per-collection config.ts
  // files are no longer loaded. A leftover one is a loud migration error.
  const staleConfigErrors: string[] = [];
  const discoveredContexts: CollectionContext[] = await Promise.all(
    discoveredCollections.map(async (dc: DiscoveredCollection) => {
      try {
        await fs.access(path.join(dc.collectionPath, "config.ts"));
        staleConfigErrors.push(
          `Collection "${dc.name}": ${path.relative(cwd, dc.collectionPath)}/config.ts is no longer loaded. ` +
            `Move overrides into contenz.config.ts (collections.${dc.name}.config), importing and merging shared fragments explicitly if needed.`
        );
      } catch {
        // Absent — the only supported state.
      }
      const config = resolveConfig(projectConfig);

      const schema = await loadSchemaModule(dc.collectionPath);

      const contentFiles = await globContentFiles(
        dc.collectionPath,
        config.extensions,
        config.ignore
      );

      detectSlugCollisions(dc.name, contentFiles, config);

      return {
        name: dc.name,
        collectionPath: dc.collectionPath,
        kind: "collection",
        config,
        collectionConfig: undefined,
        schema,
        contentFiles,
      };
    })
  );

  // Merge inline declared collections (from config.collections)
  const inlineEntries = projectConfig.collections ?? {};
  const inlineContexts: CollectionContext[] = await Promise.all(
    Object.entries(inlineEntries).map(
      async ([name, decl]: [string, CollectionDeclaration]) => {
        const collectionPath = path.resolve(cwd, decl.path);
        // Overrides come only from the central config (explicit imports by
        // the user when shared). No per-directory config.ts loading.
        const collectionConfig = decl.config;
        const config = resolveConfig(projectConfig, collectionConfig);

        // Build schema module from inline schema or fall back to file
        let schema: SchemaModule | null = null;
        if (decl.schema) {
          schema = {
            meta: decl.schema,
            relations: decl.relations,
            computed: decl.computed,
          };
        } else {
          schema = await loadSchemaModule(collectionPath);
        }

        const contentFiles = await globContentFiles(
          collectionPath,
          config.extensions,
          config.ignore
        );

        detectSlugCollisions(name, contentFiles, config);

        return {
          name,
          collectionPath,
          kind: "collection",
          config,
          collectionConfig,
          schema,
          contentFiles,
        };
      }
    )
  );

  // Merge: inline declarations override filesystem-discovered collections
  const collectionMap = new Map<string, CollectionContext>();
  for (const ctx of discoveredContexts) {
    collectionMap.set(ctx.name, ctx);
  }
  for (const ctx of inlineContexts) {
    collectionMap.set(ctx.name, ctx); // inline wins
  }
  const collections = [...collectionMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Singles (from config.singles): explicit file paths, no discovery.
  // The single's name acts as its slug; locale variants live alongside the
  // canonical file (`site.yml` + `site.zh.yml`).
  const singleErrors: string[] = [];
  const singleEntries = projectConfig.singles ?? {};
  const singleContexts: CollectionContext[] = await Promise.all(
    Object.entries(singleEntries)
      .filter(([name]) => !options.collection || options.collection === name)
      .map(async ([name, decl]): Promise<CollectionContext> => {
        if (decl.config?.types?.length || decl.config?.slugPattern) {
          throw new Error(
            `Single "${name}" must not define types or slugPattern (singles are key-addressed, not filename-routed).`
          );
        }
        const filePath = path.resolve(cwd, decl.path);
        const dir = path.dirname(filePath);
        const canonical = path.basename(filePath);
        const collectionConfig = decl.config;
        const config = resolveConfig(projectConfig, collectionConfig);

        let schema: SchemaModule | null = null;
        if (decl.schema) {
          schema = {
            meta: decl.schema,
            relations: decl.relations,
            computed: decl.computed,
          };
        }

        const dirFiles = await globContentFiles(
          dir,
          config.extensions,
          config.ignore
        );
        const contentFiles = dirFiles.filter((f) => {
          const parsed = parseFileName(
            f,
            config.i18n,
            undefined,
            config.extensions
          );
          return parsed !== null && parsed.slug === name;
        });

        if (!contentFiles.includes(canonical)) {
          singleErrors.push(
            `Single "${name}": file "${decl.path}" not found or does not match the single name.`
          );
        }

        detectSlugCollisions(name, contentFiles, config);

        return {
          name,
          collectionPath: dir,
          kind: "single",
          config,
          collectionConfig,
          schema,
          contentFiles,
        };
      })
  );
  const singles = singleContexts.sort((a, b) => a.name.localeCompare(b.name));

  return {
    cwd,
    projectConfig,
    resolvedConfig,
    sources,
    collections,
    singles,
    discoveryErrors: [
      ...discovery.errors,
      ...staleConfigErrors,
      ...singleErrors,
    ],
    getCollection(name: string): CollectionContext | undefined {
      return collections.find((c) => c.name === name);
    },
    getSingle(name: string): CollectionContext | undefined {
      return singles.find((c) => c.name === name);
    },
  };
}

function detectSlugCollisions(
  collectionName: string,
  contentFiles: string[],
  config: ResolvedConfig
): void {
  const slugMap = new Map<string, string[]>();
  for (const file of contentFiles) {
    const fileName = path.basename(file);
    const parsed = parseFileName(
      fileName,
      config.i18n,
      config.slugPattern,
      config.extensions
    );
    if (!parsed) continue;

    const key = config.i18n ? `${parsed.slug}.${parsed.locale}` : parsed.slug;
    const existing = slugMap.get(key) || [];
    existing.push(file);
    slugMap.set(key, existing);
  }

  for (const [key, files] of slugMap.entries()) {
    if (files.length > 1) {
      throw new Error(
        `Slug collision detected in collection "${collectionName}": Files ${files.join(
          ", "
        )} resolve to the same slug${config.i18n ? " and locale" : ""} ("${key}").`
      );
    }
  }
}
