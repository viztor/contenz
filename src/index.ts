/**
 * content-tools – Content validation and codegen from MDX/Markdown with Zod.
 *
 * Use the CLI: `content-tools lint`, `content-tools build`
 * Use in schema files: `import { defineCollection } from "content-tools"`
 */

export type {
  ProjectConfig,
  CollectionConfig,
  ResolvedConfig,
  ContentType,
  Relations,
  SchemaModule,
  ConfigModule,
  ParsedContent,
  CollectionItem,
  CollectionStats,
} from "./types.js";

export {
  defineCollection,
  defineMultiTypeCollection,
  type DefineCollectionSingleOptions,
  type DefineCollectionMultiOptions,
} from "./define-collection.js";
