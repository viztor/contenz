import { runLint } from "@contenz/core/api";
import { buildCommand } from "@stricli/core";

import type { ContenzContext } from "../context.js";
import { log } from "../output.js";
import {
  cwdFlag,
  diagnosticFormatFlag,
  dryRunFlag,
  type DiagnosticFormat,
} from "../shared.js";

interface LintFlags {
  cwd: string;
  dir?: string;
  collection?: string;
  coverage: boolean;
  translations: boolean;
  dryRun: boolean;
  format: DiagnosticFormat;
}

async function lint(this: ContenzContext, flags: LintFlags): Promise<void> {
  const result = await runLint({
    cwd: flags.cwd,
    dir: flags.dir,
    collection: flags.collection,
    coverage: flags.coverage,
    translations: flags.translations,
    dryRun: flags.dryRun,
    format: flags.format,
  });
  log(this, result.report);
  if (!result.success) this.process.exitCode = 1;
}

export const lintCommandDef = buildCommand({
  func: lint,
  parameters: {
    flags: {
      cwd: cwdFlag,
      dir: {
        kind: "parsed",
        brief: 'Legacy source root override (treated as "<dir>/*")',
        parse: String,
        optional: true,
        placeholder: "dir",
      },
      collection: {
        kind: "parsed",
        brief: "Specific collection to lint",
        parse: String,
        optional: true,
        placeholder: "name",
      },
      coverage: {
        kind: "boolean",
        brief: "Write coverage report file (e.g. contenz.coverage.md)",
        default: false,
      },
      translations: {
        kind: "boolean",
        brief: "Check translation completeness against declared i18n.locales",
        default: false,
      },
      dryRun: dryRunFlag,
      format: diagnosticFormatFlag,
    },
    aliases: {
      c: "cwd",
    },
  },
  docs: {
    brief: "Validate content files against their schemas",
    fullDescription:
      "Parse and validate all content (or a single collection). Optionally write a coverage report or check i18n completeness.",
  },
});
