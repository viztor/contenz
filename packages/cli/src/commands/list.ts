import { runList } from "@contenz/core/api";
import { defineCommand } from "citty";
import { printAndExit } from "../output.js";

export const listCommand = defineCommand({
	meta: {
		name: "list",
		description: "List collections or content items within a collection",
	},
	args: {
		collection: {
			type: "positional",
			description: "Collection name (omit to list all collections)",
			required: false,
		},
		cwd: {
			type: "string",
			description: "Project root",
			default: ".",
		},
		format: {
			type: "string",
			description: "Output format: json or pretty",
			default: "json",
		},
	},
	async run({ args }) {
		const result = await runList({
			cwd: args.cwd,
			collection: args.collection,
		});
		printAndExit(result, args.format);
	},
});
