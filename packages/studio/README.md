# Contenz Studio

Authoring studio for Contenz content: browse collections, edit documents with schema-validated metadata and a rich body editor, and full-text search. All changes are written back to the repository.

## Running the studio

From a Contenz project (or from the repo root with a project path):

```bash
contenz studio
contenz studio --cwd ./my-content --port 3002
```

- **`--cwd`**: Project root where `contenz.config.ts` and content sources live (default: current directory). Passed as `CONTENZ_PROJECT_ROOT`.
- **`--port`**: Dev server port (default: 3001).

Open the URL shown in the terminal (e.g. http://localhost:3001). Full details: [docs/STUDIO.md](../../docs/STUDIO.md).

## Features

- **Project & collections**: Home shows project path and discovered collections; click a collection to list documents.
- **Document editor**: Open a document to edit metadata (validated against the collection’s Zod schema) and body in an MDX editor (toolbar, rich/source toggle, links, code blocks). Save writes back to the repo.
- **Full-text search**: Sidebar search and Search page; results link to the document editor.
- **Coverage**: When i18n is enabled, access to coverage reporting.
- **Settings**: Project settings view.

## Stack

- Next.js 16 (App Router), React 19
- Tailwind CSS v4, shadcn/ui (Base UI)
- MDXEditor for rich body editing
- `@contenz/core` for config, discovery, parsing, validation, and serialization

## Development

From the monorepo:

```bash
npm install
CONTENZ_PROJECT_ROOT="$(pwd)/packages/e2e/fixtures/mixed-sources" npm run dev --workspace=@contenz/studio
```

Or run via the CLI from repo root:

```bash
contenz studio --cwd packages/e2e/fixtures/mixed-sources
```

See [docs/STUDIO.md](../../docs/STUDIO.md) for environment, API routes, and saving/validation behavior.
