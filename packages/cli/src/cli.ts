#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { run } from "@stricli/core";

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

await run(app, process.argv.slice(2), buildContext());
