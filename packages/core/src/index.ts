/**
 * contenz – Content validation and codegen from MDX/Markdown with Zod.
 *
 * Use the CLI: `contenz lint`, `contenz build`
 * Use in schema files: `import { defineCollection } from "@contenz/core"`
 */

export {
  type DefineCollectionMultiOptions,
  type DefineCollectionSingleOptions,
  defineCollection,
  defineMultiTypeCollection,
} from "./define-collection.js";
export type {
  Diagnostic,
  DiagnosticCategory,
  DiagnosticFormat,
  DiagnosticSeverity,
  DiagnosticSummary,
} from "./diagnostics.js";
export type {
  CollectionConfig,
  CollectionItem,
  CollectionStats,
  ConfigModule,
  ContentType,
  ContenzConfig,
  ParsedContent,
  Relations,
  ResolvedConfig,
  SchemaModule,
} from "./types.js";
