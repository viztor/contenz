import { runStatus } from "@contenz/core/api";
import { buildCommand } from "@stricli/core";

import type { ContenzContext } from "../context.js";
import { log } from "../output.js";
import { cwdFlag } from "../shared.js";

interface StatusFlags {
  cwd: string;
}

async function status(this: ContenzContext, flags: StatusFlags): Promise<void> {
  const result = await runStatus({ cwd: flags.cwd });
  log(this, result.message);
  if (result.dirtyCollections.length > 0) {
    log(this, `Would rebuild: ${result.dirtyCollections.join(", ")}`);
  }
  if (result.freshCollections.length > 0) {
    log(this, `Up to date: ${result.freshCollections.join(", ")}`);
  }
  if (result.status === "needs-build") this.process.exitCode = 1;
}

export const statusCommandDef = buildCommand({
  func: status,
  parameters: {
    flags: {
      cwd: cwdFlag,
    },
  },
  docs: {
    brief: "Report whether build is up to date or needs rebuild",
  },
});
