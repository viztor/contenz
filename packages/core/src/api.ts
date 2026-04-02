/**
 * Programmatic API for contenz.
 * Import from "@contenz/core/api".
 */
export {
  extractRelations,
  getContentType,
  getSchemaForType,
  loadCollectionConfig,
  loadProjectConfig,
  loadSchemaModule,
  resolveConfig,
} from "./config.js";
export {
  type ContentLocation,
  readContent,
  resolveContentFile,
  updateContent,
  type WriteContentOptions,
  writeContent,
} from "./content-io.js";
export type {
  Diagnostic,
  DiagnosticFormat,
  DiagnosticSummary,
} from "./diagnostics.js";
export {
  type FormatAdapter,
  getAdapterForExtension,
  jsonAdapter,
  registerAdapters,
} from "./format-adapter.js";
export {
  type IntrospectedField,
  type IntrospectedSchema,
  introspectField,
  introspectSchema,
  type SchemaFieldType,
} from "./introspect.js";
export {
  extractBodyFromSource,
  parseContentFile,
  parseFileName,
  serializeContentFile,
} from "./parser.js";
export type { BuildOptions, BuildResult } from "./run-build.js";
export { runBuild } from "./run-build.js";
export {
  type CollectionInfo,
  type ContentOpResult,
  type CreateOptions,
  type CreateResult,
  type ListItemInfo,
  type ListOptions,
  runCreate,
  runList,
  runUpdate,
  runView,
  type UpdateOptions,
  type UpdateResult,
  type ViewOptions,
  type ViewResult,
} from "./run-content-ops.js";
export type { LintOptions, LintResult } from "./run-lint.js";
export { runLint } from "./run-lint.js";
export {
  runSchema,
  type SchemaOptions,
  type SchemaResultData,
} from "./run-schema.js";
export {
  runSearch,
  type SearchOptions,
  type SearchResultData,
  type SearchResultItem,
} from "./run-search.js";
export type { StatusOptions, StatusResult } from "./run-status.js";
export { runStatus } from "./run-status.js";
export {
  createSearchIndex,
  loadSearchIndex,
  querySearchIndex,
  type SearchDocument,
  type SearchIndexHit,
  type SearchIndexQuery,
  saveSearchIndex,
} from "./search-index.js";
export type { DiscoveredCollection } from "./sources.js";
export { discoverCollections, globContentFiles, resolveSourcePatterns } from "./sources.js";
export type { ContenzConfig, SchemaModule } from "./types.js";
export type { ValidationError, ValidationResult } from "./validator.js";
export { validateMeta } from "./validator.js";
export {
  type CollectionContext,
  type CreateWorkspaceOptions,
  createWorkspace,
  type Workspace,
} from "./workspace.js";
