import { runUpdate } from "@contenz/core/api";
import { buildCommand } from "@stricli/core";

import type { ContenzContext } from "../context.js";
import { printResult } from "../output.js";
import {
  cwdFlag,
  localeFlag,
  outputFormatFlag,
  parseSetPairs,
  setFlag,
  unsetFlag,
  type OutputFormat,
} from "../shared.js";

interface UpdateFlags {
  cwd: string;
  locale?: string;
  set?: readonly string[];
  unset?: readonly string[];
  format: OutputFormat;
}

async function update(
  this: ContenzContext,
  flags: UpdateFlags,
  collection: string,
  slug?: string
): Promise<void> {
  const setFields = parseSetPairs(flags.set);
  const unsetFields = flags.unset ? [...flags.unset] : [];

  const result = await runUpdate({
    cwd: flags.cwd,
    collection,
    slug,
    set: setFields,
    unset: unsetFields,
    locale: flags.locale,
  });
  printResult(this, result, flags.format);
}

export const updateCommandDef = buildCommand({
  func: update,
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
          brief: "Content slug (omit for singles)",
          parse: String,
          placeholder: "slug",
          optional: true,
        },
      ],
    },
    flags: {
      cwd: cwdFlag,
      locale: localeFlag,
      set: setFlag,
      unset: unsetFlag,
      format: outputFormatFlag,
    },
  },
  docs: {
    brief: "Update fields on an existing content item",
    fullDescription:
      "Update with --set key=value and/or --unset field (both repeatable).",
  },
});
