# Studio

The Contenz Studio is a web-based authoring UI for repo-backed content. It lets you browse collections, open documents, edit metadata and body, and search across content. All changes are written back to the repository.

## Running the studio

From a Contenz project (or from any directory with `--cwd` pointing to one):

```bash
contenz studio
contenz studio --cwd ./my-content --port 3002
```

- **--cwd**: Project root where `contenz.config.ts` and content live. This is passed as `CONTENZ_PROJECT_ROOT` to the Next.js app.
- **--port**: Dev server port (default 3001).

Open the URL printed in the terminal (e.g. http://localhost:3001). The studio discovers collections from the project config and lists them in the sidebar.

## Features

- **Home**: Project path and list of discovered collections. Click a collection to see its documents.
- **Collection view**: List of documents (by slug/file). Click a document to open the document editor.
- **Document editor**:
  - **Header**: Document slug and filename (e.g. `hello.mdx`). Save and “Back to collection” actions.
  - **Metadata**: Collapsible section with one field per schema key. Edits are validated against the collection’s Zod schema. Validation errors are shown inline.
  - **Body**: Rich editor (MDXEditor) for the markdown/MDX body. Toolbar: undo/redo, formatting, block type, link, code block; toggle between rich text and source.
- **Search**: Sidebar search and dedicated Search page. Full-text search over document metadata and body. Results link to the document editor.
- **Coverage** (when i18n is enabled): Link to coverage report or coverage-related views.
- **Settings**: Project settings and config summary.

## Environment

The studio expects:

- **CONTENZ_PROJECT_ROOT**: Set by the CLI when you run `contenz studio --cwd <path>`. Must point to a directory that contains `contenz.config.ts` and the content sources. If you run the Next.js app manually (e.g. from `packages/studio`), set this yourself:

  ```bash
  CONTENZ_PROJECT_ROOT=/path/to/your/contenz-project npm run dev
  ```

## Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS v4, shadcn/ui (Base UI)
- MDXEditor for body editing (toolbar, diff/source toggle, links, code blocks)
- `@contenz/core` for config, discovery, parsing, validation, and serialization

## Development (monorepo)

To work on the studio from the repo:

```bash
npm install
cd packages/studio && npm run dev
```

Set `CONTENZ_PROJECT_ROOT` to a Contenz project (e.g. `packages/e2e/fixtures/mixed-sources`) so the API can discover collections and documents:

```bash
CONTENZ_PROJECT_ROOT="$(pwd)/packages/e2e/fixtures/mixed-sources" npm run dev --workspace=@contenz/studio
```

Or from repo root:

```bash
contenz studio --cwd packages/e2e/fixtures/mixed-sources
```

## API routes

The studio uses internal Next.js API routes that call `@contenz/core`:

- Project and collection config
- Document list and file tree
- Document content (GET/PUT) with validation
- Search over metadata and body
- i18n/coverage when applicable

These are not part of the public `@contenz/core` API; they are implementation details of the studio app.

## Saving and validation

- **Save**: Writes current metadata and body to the content file in the repo (frontmatter + body or export + body depending on format). Fails if schema validation fails; errors are shown in the UI.
- **Validation**: Runs on load and on save. Schema errors are displayed in a card above the metadata section. Fix the reported fields and save again.

For full CLI and config details see [CLI reference](./CLI.md) and [Configuration](./CONFIGURATION.md).
