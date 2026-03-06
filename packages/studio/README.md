# Contenz Studio

Authoring studio for Contenz content: browse collections, view documents with schema-validated metadata, and full-text search.

## Running the studio

From a Contenz project (or from the repo root with a project path):

```bash
contenz studio
# Or with options:
contenz studio --cwd ./my-content --port 3002
```

- **`--cwd`**: Project root where `contenz.config.ts` and content sources live (default: current directory).
- **`--port`**: Dev server port (default: 3001).

The CLI sets `CONTENZ_PROJECT_ROOT` and starts the Next.js dev server. Open the shown URL (e.g. http://localhost:3001).

## Features

- **Project & collections**: Home page shows project path and discovered collections; click a collection to list documents.
- **Document view**: Open a document to see metadata (validated against the collection’s Zod schema) and raw body in tabs. Schema validation errors are shown when present.
- **Full-text search**: Use the sidebar search or the Search page to search across document metadata and body. Results link to the document view.

## Stack

- Next.js 14, React 18, Tailwind, shadcn/ui.
- `@contenz/core` for config, discovery, parsing, and schema validation.
- MDXEditor is planned for rich body editing in a later phase.

## Development

From the monorepo:

```bash
pnpm install
cd packages/studio && pnpm dev
```

Set `CONTENZ_PROJECT_ROOT` to a project path that has Contenz content (e.g. the repo’s fixture or another project) so the API can discover collections and documents.
