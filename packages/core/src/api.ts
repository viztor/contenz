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
export type {
  Diagnostic,
  DiagnosticFormat,
  DiagnosticSummary,
} from "./diagnostics.js";
export {
  extractBodyFromSource,
  parseContentFile,
  parseFileName,
  serializeContentFile,
} from "./parser.js";
export type { BuildOptions, BuildResult } from "./run-build.js";
export { runBuild } from "./run-build.js";
export type { LintOptions, LintResult } from "./run-lint.js";
export { runLint } from "./run-lint.js";
export type { StatusOptions, StatusResult } from "./run-status.js";
export { runStatus } from "./run-status.js";
export type { DiscoveredCollection } from "./sources.js";
export { discoverCollections, resolveSourcePatterns } from "./sources.js";
export type { ContenzConfig, SchemaModule } from "./types.js";
export type { ValidationError, ValidationResult } from "./validator.js";
export { validateMeta } from "./validator.js";
