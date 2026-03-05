#!/usr/bin/env node

import { createRequire } from "node:module";
import { defineCommand, runMain } from "citty";
import { buildCommand } from "./commands/build.js";
import { lintCommand } from "./commands/lint.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const main = defineCommand({
  meta: {
    name: "contenz",
    version: pkg.version,
    description: "Content validation and generation tools",
  },
  subCommands: {
    lint: lintCommand,
    build: buildCommand,
  },
});

runMain(main);
