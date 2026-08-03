import { runSearch } from "@contenz/core/api";
import { buildCommand } from "@stricli/core";

import type { ContenzContext } from "../context.js";
import { printResult } from "../output.js";
import {
  cwdFlag,
  fieldFilterFlag,
  limitFlag,
  localeFlag,
  outputFormatFlag,
  parseFieldPairs,
  type OutputFormat,
} from "../shared.js";

interface SearchFlags {
  cwd: string;
  field?: readonly string[];
  locale?: string;
  limit?: number;
  format: OutputFormat;
}

async function search(
  this: ContenzContext,
  flags: SearchFlags,
  collection: string,
  query?: string
): Promise<void> {
  const fields = parseFieldPairs(flags.field);
  const result = await runSearch({
    cwd: flags.cwd,
    collection,
    query: query || undefined,
    fields: Object.keys(fields).length > 0 ? fields : undefined,
    locale: flags.locale,
    limit: flags.limit,
  });
  printResult(this, result, flags.format);
}

export const searchCommandDef = buildCommand({
  func: search,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Collection name",
          parse: String,
          placeholder: "collection",
        },
        {
          brief: "Substring to match against slugs",
          parse: String,
          placeholder: "query",
          optional: true,
        },
      ],
    },
    flags: {
      cwd: cwdFlag,
      field: fieldFilterFlag,
      locale: localeFlag,
      limit: limitFlag,
      format: outputFormatFlag,
    },
  },
  docs: {
    brief: "Search content items in a collection by slug or field values",
  },
});
