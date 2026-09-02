/**
 * contenz – Content validation and codegen from MDX/Markdown/JSON with Zod.
 *
 * Use the CLI: `contenz lint`, `contenz build`
 * Use in schema files: `import { defineCollection } from "@contenz/core"`
 */

export {
  type ComputedFields,
  type DefineCollectionMultiOptions,
  type DefineCollectionSingleOptions,
  defineCollection,
  defineMultiTypeCollection,
  type MultiTypeExports,
  type SchemaWithPattern,
} from "./define-collection.js";
export type { FormatAdapter } from "./format-adapter.js";
export { type ResolvedLocaleEntry, resolveI18nEntry } from "./i18n.js";
export { presets } from "./presets.js";
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
