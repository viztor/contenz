import { createRequire } from "node:module";

import {
  buildInstallCommand,
  buildUninstallCommand,
} from "@stricli/auto-complete";
import { buildApplication, buildRouteMap } from "@stricli/core";

import { buildCommandDef } from "./commands/build.js";
import { createCommandDef } from "./commands/create.js";
import { initCommandDef } from "./commands/init.js";
import { lintCommandDef } from "./commands/lint.js";
import { listCommandDef } from "./commands/list.js";
import { schemaCommandDef } from "./commands/schema.js";
import { searchCommandDef } from "./commands/search.js";
import { skillCommandDef } from "./commands/skill.js";
import { statusCommandDef } from "./commands/status.js";
import { updateCommandDef } from "./commands/update.js";
import { viewCommandDef } from "./commands/view.js";
import { watchCommandDef } from "./commands/watch.js";
import type { ContenzContext } from "./context.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as {
  name: string;
  version: string;
  description: string;
};

export const APP_NAME = "contenz";
export const APP_VERSION = pkg.version;
export const APP_DESCRIPTION =
  pkg.description ?? "Content validation and generation tools";

/** Binary name registered in package.json for bash tab-completion */
export const BASH_COMPLETE_BIN = `__${APP_NAME}_bash_complete`;

const routes = buildRouteMap({
  routes: {
    init: initCommandDef,
    lint: lintCommandDef,
    build: buildCommandDef,
    watch: watchCommandDef,
    schema: schemaCommandDef,
    skill: skillCommandDef,
    status: statusCommandDef,
    view: viewCommandDef,
    list: listCommandDef,
    create: createCommandDef,
    update: updateCommandDef,
    search: searchCommandDef,
    // Shell completion installers (hidden from default help)
    install: buildInstallCommand<ContenzContext>(APP_NAME, {
      bash: BASH_COMPLETE_BIN,
    }),
    uninstall: buildUninstallCommand<ContenzContext>(APP_NAME, {
      bash: true,
    }),
  },
  docs: {
    brief: APP_DESCRIPTION,
    fullDescription:
      "Validate MDX/Markdown/JSON content against Zod schemas, generate typed output, and manage content from the CLI or AI agents.",
    hideRoute: {
      install: true,
      uninstall: true,
    },
  },
});

export const app = buildApplication<ContenzContext>(routes, {
  name: APP_NAME,
  versionInfo: {
    currentVersion: APP_VERSION,
  },
  scanner: {
    // Accept --dry-run for dryRun, etc.
    caseStyle: "allow-kebab-for-camel",
  },
  documentation: {
    // Display kebab-case in help text
    caseStyle: "convert-camel-to-kebab",
  },
  determineExitCode() {
    return 1;
  },
});
