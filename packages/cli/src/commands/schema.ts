import { runSchema } from "@contenz/core/api";
import { defineCommand } from "citty";
import { printAndExit } from "../output.js";

export const schemaCommand = defineCommand({
	meta: {
		name: "schema",
		description:
			"Introspect the schema of a collection (fields, types, descriptions)",
	},
	args: {
		collection: {
			type: "positional",
			description: "Collection name",
			required: true,
		},
		type: {
			type: "string",
			description: "Content type (for multi-type collections)",
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
		const result = await runSchema({
			cwd: args.cwd,
			collection: args.collection,
			contentType: args.type,
		});
		printAndExit(result, args.format);
	},
});
