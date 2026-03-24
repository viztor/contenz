/**
 * Workspace: consolidated project context loaded once and shared across pipelines.
 *
 * Eliminates the repeated config/discovery/schema loading in run-build.ts and run-lint.ts.
 * Each pipeline calls `createWorkspace(cwd, sources?)` once and passes the result around.
 */

import path from "node:path";
import {
  loadCollectionConfig,
  loadProjectConfig,
  loadSchemaModule,
  resolveConfig,
} from "./config.js";
import { registerAdapters } from "./format-adapter.js";
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
  /** Collection name (directory basename) */
  name: string;
  /** Absolute path to the collection directory */
  collectionPath: string;
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
  /** All discovered and loaded collections */
  collections: CollectionContext[];
  /** Errors encountered during collection discovery */
  discoveryErrors: string[];

  /** Get a collection context by name */
  getCollection(name: string): CollectionContext | undefined;
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
export async function createWorkspace(options: CreateWorkspaceOptions): Promise<Workspace> {
  const cwd = options.cwd;
  const projectConfig = await loadProjectConfig(cwd);
  const resolvedConfig = resolveConfig(projectConfig);

  // Register external format adapters from config (e.g. @contenz/adapter-mdx)
  if (projectConfig.adapters?.length) {
    registerAdapters(projectConfig.adapters);
  }

  const sources =
    options.sources ??
    (options.dir ? [normalizeLegacyContentDir(options.dir)] : resolvedConfig.sources);

  const discovery = await discoverCollections(cwd, sources);
  let discoveredCollections = discovery.collections;

  // Filter to single collection if requested
  if (options.collection) {
    discoveredCollections = discoveredCollections.filter((c) => c.name === options.collection);
  }

  // Load each discovered collection's config, schema, and content file list
  const discoveredContexts: CollectionContext[] = await Promise.all(
    discoveredCollections.map(async (dc: DiscoveredCollection) => {
      const collectionConfig = await loadCollectionConfig(dc.collectionPath);
      const config = resolveConfig(projectConfig, collectionConfig);

      const schema = await loadSchemaModule(dc.collectionPath);

      const contentFiles = await globContentFiles(
        dc.collectionPath,
        config.extensions,
        config.ignore
      );

      return {
        name: dc.name,
        collectionPath: dc.collectionPath,
        config,
        collectionConfig,
        schema,
        contentFiles,
      };
    })
  );

  // Merge inline declared collections (from config.collections)
  const inlineEntries = projectConfig.collections ?? {};
  const inlineContexts: CollectionContext[] = await Promise.all(
    Object.entries(inlineEntries).map(async ([name, decl]: [string, CollectionDeclaration]) => {
      const collectionPath = path.resolve(cwd, decl.path);
      const collectionConfig = decl.config ?? (await loadCollectionConfig(collectionPath));
      const config = resolveConfig(projectConfig, collectionConfig);

      // Build schema module from inline schema or fall back to file
      let schema: SchemaModule | null = null;
      if (decl.schema) {
        schema = { meta: decl.schema, relations: decl.relations };
      } else {
        schema = await loadSchemaModule(collectionPath);
      }

      const contentFiles = await globContentFiles(collectionPath, config.extensions, config.ignore);

      return {
        name,
        collectionPath,
        config,
        collectionConfig,
        schema,
        contentFiles,
      };
    })
  );

  // Merge: inline declarations override filesystem-discovered collections
  const collectionMap = new Map<string, CollectionContext>();
  for (const ctx of discoveredContexts) {
    collectionMap.set(ctx.name, ctx);
  }
  for (const ctx of inlineContexts) {
    collectionMap.set(ctx.name, ctx); // inline wins
  }
  const collections = [...collectionMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  return {
    cwd,
    projectConfig,
    resolvedConfig,
    sources,
    collections,
    discoveryErrors: discovery.errors,
    getCollection(name: string): CollectionContext | undefined {
      return collections.find((c) => c.name === name);
    },
  };
}
