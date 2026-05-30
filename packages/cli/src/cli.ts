#!/usr/bin/env node

import { createRequire } from "node:module";
import { defineCommand, runMain } from "citty";
import { buildCommand } from "./commands/build.js";
import { createCommand } from "./commands/create.js";
import { initCommand } from "./commands/init.js";
import { lintCommand } from "./commands/lint.js";
import { listCommand } from "./commands/list.js";
import { schemaCommand } from "./commands/schema.js";
import { searchCommand } from "./commands/search.js";
import { skillCommand } from "./commands/skill.js";
import { statusCommand } from "./commands/status.js";
import { updateCommand } from "./commands/update.js";
import { viewCommand } from "./commands/view.js";
import { watchCommand } from "./commands/watch.js";
import { previewCommand } from "./commands/preview.js";

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
		preview: previewCommand,
		schema: schemaCommand,
		skill: skillCommand,
		status: statusCommand,
		// AI-native commands
		view: viewCommand,
		list: listCommand,
		create: createCommand,
		update: updateCommand,
		search: searchCommand,
	},
});

runMain(main);
