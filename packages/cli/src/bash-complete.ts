#!/usr/bin/env node

/**
 * Bash completion entrypoint for contenz.
 * Invoked by the shell as: __contenz_bash_complete $COMP_LINE
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { proposeCompletions } from "@stricli/core";

import { app } from "./app.js";
import type { ContenzContext } from "./context.js";

function buildContext(): ContenzContext {
  return {
    process,
    os,
    fs,
    path,
  };
}

// COMP_LINE is expanded into argv by bash: bin + words of the line.
// Skip node, script, and the first token (the command name itself).
const inputs = process.argv.slice(3);
if (process.env.COMP_LINE?.endsWith(" ")) {
  inputs.push("");
}

try {
  const completions = await proposeCompletions(app, inputs, buildContext());
  for (const { completion } of completions) {
    process.stdout.write(`${completion}\n`);
  }
} catch {
  // Completions must not print errors into COMPREPLY
}
