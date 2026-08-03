import type * as fs from "node:fs";
import type * as os from "node:os";
import type * as path from "node:path";

import type { CommandContext } from "@stricli/core";

/**
 * Contenz CLI command context.
 * Extends Stricli's CommandContext with Node process + modules needed for
 * shell autocomplete install/uninstall and long-running watch.
 */
export interface ContenzContext extends CommandContext {
  readonly process: NodeJS.Process;
  readonly os: Pick<typeof os, "homedir">;
  readonly fs: {
    readonly promises: Pick<typeof fs.promises, "readFile" | "writeFile">;
  };
  readonly path: Pick<typeof path, "join">;
}
