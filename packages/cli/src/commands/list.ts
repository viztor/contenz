import { runList } from "@contenz/core/api";
import { buildCommand } from "@stricli/core";

import type { ContenzContext } from "../context.js";
import { printResult } from "../output.js";
import { cwdFlag, outputFormatFlag, type OutputFormat } from "../shared.js";

interface ListFlags {
  cwd: string;
  format: OutputFormat;
}

async function list(
  this: ContenzContext,
  flags: ListFlags,
  collection?: string
): Promise<void> {
  const result = await runList({
    cwd: flags.cwd,
    collection,
  });
  printResult(this, result, flags.format);
}

export const listCommandDef = buildCommand({
  func: list,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Collection name (omit to list all collections)",
          parse: String,
          placeholder: "collection",
          optional: true,
        },
      ],
    },
    flags: {
      cwd: cwdFlag,
      format: outputFormatFlag,
    },
  },
  docs: {
    brief: "List collections or content items within a collection",
  },
});
