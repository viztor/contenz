/**
 * Shared output utilities for CLI commands.
 * Handles JSON envelope vs pretty-print formatting in one place.
 */

import type { ContentOpResult } from "@contenz/core/api";
import { inspect } from "node:util";

/**
 * Print the result and exit with appropriate code.
 */
export function printAndExit(result: ContentOpResult, format: string): never {
	if (format === "json") {
		console.log(JSON.stringify(result, null, 2));
	} else {
		if (result.success && result.data) {
			console.log(inspect(result.data, { colors: true, depth: null }));
		} else {
			console.error(`\x1b[31mError: ${result.error ?? "Unknown error"}\x1b[0m`);
			if (result.diagnostics?.length) {
				for (const d of result.diagnostics) {
					console.error(
						`  ${d.field ? `\x1b[33m${d.field}:\x1b[0m ` : ""}${d.message}`,
					);
				}
			}
		}
	}
	process.exit(result.success ? 0 : 1);
}
