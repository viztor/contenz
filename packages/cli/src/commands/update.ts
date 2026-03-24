import { runUpdate } from "@contenz/core/api";
import { defineCommand } from "citty";
import { printAndExit } from "../output.js";

export const updateCommand = defineCommand({
	meta: {
		name: "update",
		description: "Update fields on an existing content item",
	},
	args: {
		collection: {
			type: "positional",
			description: "Collection name",
			required: true,
		},
		slug: {
			type: "positional",
			description: "Content slug",
			required: true,
		},
		locale: {
			type: "string",
			description: "Locale to update",
			required: false,
		},
		set: {
			type: "string",
			description: "Set field values (key=value), repeatable",
			required: false,
		},
		unset: {
			type: "string",
			description: "Remove optional fields, repeatable",
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
		// Parse --set flags
		const setFields: Record<string, unknown> = {};
		if (args.set) {
			const pairs = Array.isArray(args.set) ? args.set : [args.set];
			for (const pair of pairs) {
				const eqIdx = pair.indexOf("=");
				if (eqIdx === -1) {
					printAndExit(
						{
							success: false,
							error: `Invalid --set format: "${pair}". Expected key=value`,
						},
						args.format,
					);
				}
				const key = pair.slice(0, eqIdx);
				const rawValue = pair.slice(eqIdx + 1);
				try {
					setFields[key] = JSON.parse(rawValue);
				} catch {
					setFields[key] = rawValue;
				}
			}
		}

		// Parse --unset flags
		const unsetFields: string[] = [];
		if (args.unset) {
			const fields = Array.isArray(args.unset) ? args.unset : [args.unset];
			unsetFields.push(...fields);
		}

		const result = await runUpdate({
			cwd: args.cwd,
			collection: args.collection,
			slug: args.slug,
			set: setFields,
			unset: unsetFields,
			locale: args.locale,
		});
		printAndExit(result, args.format);
	},
});
