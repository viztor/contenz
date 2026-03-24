/**
 * contenz – Content validation and codegen from MDX/Markdown/JSON with Zod.
 *
 * Use the CLI: `contenz lint`, `contenz build`
 * Use in schema files: `import { defineCollection } from "@contenz/core"`
 */

export {
  type ContentLocation,
  readContent,
  resolveContentFile,
  updateContent,
  type WriteContentOptions,
  writeContent,
} from "./content-io.js";
export {
  type DefineCollectionMultiOptions,
  type DefineCollectionSingleOptions,
  defineCollection,
  defineMultiTypeCollection,
  type SchemaWithPattern,
} from "./define-collection.js";
export type {
  Diagnostic,
  DiagnosticCategory,
  DiagnosticFormat,
  DiagnosticSeverity,
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
export type {
  CollectionConfig,
  CollectionDeclaration,
  CollectionItem,
  CollectionStats,
  ConfigModule,
  ContentType,
  ContenzConfig,
  I18nConfigShape,
  ParsedContent,
  Relations,
  ResolvedConfig,
  ResolvedI18nConfig,
  SchemaModule,
} from "./types.js";
export {
  type CollectionContext,
  type CreateWorkspaceOptions,
  createWorkspace,
  type Workspace,
} from "./workspace.js";
