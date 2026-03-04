#!/usr/bin/env node

import { defineCommand, runMain } from "citty";
import { lintCommand } from "./commands/lint.js";
import { buildCommand } from "./commands/build.js";

const main = defineCommand({
  meta: {
    name: "content-tools",
    version: "1.0.0",
    description: "Content validation and generation tools",
  },
  subCommands: {
    lint: lintCommand,
    build: buildCommand,
  },
});

runMain(main);
