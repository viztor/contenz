# Contenz documentation

This folder is the main documentation set for the Contenz repo. Use it to set up, configure, and work with Contenz in your project or to contribute to the codebase.

## Documentation index

| Document | Description |
|----------|-------------|
| [Architecture](./ARCHITECTURE.md) | Monorepo layout, packages, and how the pipeline fits together |
| [Configuration](./CONFIGURATION.md) | Project and collection config, schema authoring, sources |
| [CLI reference](./CLI.md) | All commands: `init`, `lint`, `build`, `watch`, `status`, and AI-native ops |
| [Content model](./CONTENT-MODEL.md) | Filename patterns, generated output shape, relations, i18n |
| [Core API](./API.md) | Programmatic API from `@contenz/core/api` |
| [Codebase reference](./CODEBASE.md) | Architecture deep-dive, module map, cleanup items |

## Planning and contribution

- [PROJECT_SCOPE.md](../PROJECT_SCOPE.md) – Product direction and scope
- [ROADMAP.md](../ROADMAP.md) – Milestone sequencing
- [BACKLOG.md](../BACKLOG.md) – Near-term work
- [CONTRIBUTING.md](../CONTRIBUTING.md) – Setup, workspace commands, and code style

## Quick start

1. **Install** in your project:
   ```bash
   npm install -D @contenz/cli
   npm install @contenz/core
   ```

2. **Scaffold** Contenz:
   ```bash
   contenz init
   ```

3. **Validate** content:
   ```bash
   contenz lint
   ```

4. **Generate** typed content:
   ```bash
   contenz build
   ```

See [CLI reference](./CLI.md) and [Configuration](./CONFIGURATION.md) for full details.
