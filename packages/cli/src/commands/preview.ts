import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { defineCommand } from "citty";
import { runList, runLint, runStatus, runView } from "@contenz/core/api";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { getPort } from "get-port-please";

const require = createRequire(import.meta.url);

export const previewCommand = defineCommand({
	meta: {
		name: "preview",
		description: "Start the local Preview & Review UI server",
	},
	args: {
		cwd: {
			type: "string",
			description: "Project root",
			default: ".",
		},
		port: {
			type: "string",
			description: "Port to run the preview server on",
			default: "3000",
		},
	},
	async run({ args }) {
		const cwd = path.resolve(args.cwd);
		const requestedPort = parseInt(args.port, 10);
		
		// Find an available port, starting with the requested port
		const port = await getPort({ port: requestedPort });
		
		const app = new Hono();

		// -- API Routes --
		
		app.get("/api/list", async (c) => {
			const result = await runList({ cwd });
			return c.json(result);
		});

		app.get("/api/status", async (c) => {
			const lint = await runLint({ cwd, format: "json" });
			const status = await runStatus({ cwd });
			return c.json({ lint, status });
		});

		app.get("/api/view", async (c) => {
			const collection = c.req.query("collection");
			const slug = c.req.query("slug");
			if (!collection || !slug) {
				return c.json({ success: false, error: "Missing collection or slug" }, 400);
			}
			const result = await runView({ cwd, collection, slug });
			return c.json(result);
		});

		// -- Static Assets Serving --
		
		let previewPath = "";
		try {
			// Resolve the path to @contenz/preview package
			const previewPkgPath = require.resolve("@contenz/preview/package.json");
			previewPath = path.join(path.dirname(previewPkgPath), "dist");
			
			// Verify dist exists
			const stat = await fs.stat(previewPath);
			if (!stat.isDirectory()) {
				throw new Error("dist is not a directory");
			}
		} catch (err) {
			console.error("Could not find @contenz/preview build. Have you built the workspace?");
			process.exit(1);
		}

		// Serve all static files from dist
		app.use(
			"/*",
			serveStatic({
				root: path.relative(process.cwd(), previewPath),
				rewriteRequestPath: (p) => p,
			})
		);

		// Fallback for SPA routing (React Router)
		app.get("*", async (c) => {
			const indexHtml = await fs.readFile(path.join(previewPath, "index.html"), "utf-8");
			return c.html(indexHtml);
		});

		console.log(`\n🚀 Contenz Preview starting...`);
		console.log(`http://localhost:${port}\n`);

		serve({
			fetch: app.fetch,
			port,
		});
	},
});
