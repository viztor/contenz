import { runSchema } from "@contenz/core/api";
import { buildCommand } from "@stricli/core";

import type { ContenzContext } from "../context.js";
import { printResult } from "../output.js";
import {
  contentTypeFlag,
  cwdFlag,
  outputFormatFlag,
  type OutputFormat,
} from "../shared.js";

interface SchemaFlags {
  cwd: string;
  type?: string;
  format: OutputFormat;
}

async function schema(
  this: ContenzContext,
  flags: SchemaFlags,
  collection: string
): Promise<void> {
  const result = await runSchema({
    cwd: flags.cwd,
    collection,
    contentType: flags.type,
  });
  printResult(this, result, flags.format);
}

export const schemaCommandDef = buildCommand({
  func: schema,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Collection name",
          parse: String,
          placeholder: "collection",
        },
      ],
    },
    flags: {
      cwd: cwdFlag,
      type: contentTypeFlag,
      format: outputFormatFlag,
    },
  },
  docs: {
    brief:
      "Introspect the schema of a collection (fields, types, descriptions)",
  },
});
