import { runBuild } from "@contenz/core/api";
import { buildCommand } from "@stricli/core";

import type { ContenzContext } from "../context.js";
import { log } from "../output.js";
import {
  cwdFlag,
  diagnosticFormatFlag,
  dryRunFlag,
  forceFlag,
  type DiagnosticFormat,
} from "../shared.js";

interface BuildFlags {
  cwd: string;
  dir?: string;
  force: boolean;
  dryRun: boolean;
  format: DiagnosticFormat;
}

async function build(this: ContenzContext, flags: BuildFlags): Promise<void> {
  const result = await runBuild({
    cwd: flags.cwd,
    dir: flags.dir,
    force: flags.force,
    dryRun: flags.dryRun,
    format: flags.format,
  });
  log(this, result.report);
  if (!result.success) this.process.exitCode = 1;
}

export const buildCommandDef = buildCommand({
  func: build,
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
      force: forceFlag,
      dryRun: dryRunFlag,
      format: diagnosticFormatFlag,
    },
    aliases: {
      f: "force",
      c: "cwd",
    },
  },
  docs: {
    brief: "Generate content data files",
    fullDescription:
      "Incrementally generate typed content output from validated sources. Use --force to ignore the build manifest cache, or --dry-run to preview without writing.",
  },
});
