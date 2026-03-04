/**
 * content-tools – Content validation and codegen from MDX/Markdown with Zod.
 *
 * Use the CLI: `content-tools lint`, `content-tools build`
 * Use in schema files: `import { defineCollection } from "content-tools"`
 */

export {
  type DefineCollectionMultiOptions,
  type DefineCollectionSingleOptions,
  defineCollection,
  defineMultiTypeCollection,
} from "./define-collection.js";
export type {
  CollectionConfig,
  CollectionItem,
  CollectionStats,
  ConfigModule,
  ContentType,
  ParsedContent,
  ProjectConfig,
  Relations,
  ResolvedConfig,
  SchemaModule,
} from "./types.js";
