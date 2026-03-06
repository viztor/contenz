#!/usr/bin/env node

import { createRequire } from "node:module";
import { defineCommand, runMain } from "citty";
import { buildCommand } from "./commands/build.js";
import { initCommand } from "./commands/init.js";
import { lintCommand } from "./commands/lint.js";
import { statusCommand } from "./commands/status.js";
import { studioCommand } from "./commands/studio.js";
import { watchCommand } from "./commands/watch.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const main = defineCommand({
  meta: {
    name: "contenz",
    version: pkg.version,
    description: "Content validation and generation tools",
  },
  subCommands: {
    init: initCommand,
    lint: lintCommand,
    build: buildCommand,
    watch: watchCommand,
    status: statusCommand,
    studio: studioCommand,
  },
});

runMain(main);
