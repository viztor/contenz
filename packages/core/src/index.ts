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
  type SchemaWithPattern,
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
  I18nConfigShape,
  ParsedContent,
  Relations,
  ResolvedConfig,
  ResolvedI18nConfig,
  SchemaModule,
} from "./types.js";
