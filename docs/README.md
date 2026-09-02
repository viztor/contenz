---
tags:
  - docs
  - moc
status: note
---

> [!important] Docs format
> Obsidian Markdown — canonical `~/dev/OBSIDIAN.md` · local [[OBSIDIAN]].

# Contenz documentation

This folder is the main documentation set for the Contenz repo. Use it to set up, configure, and work with Contenz in your project or to contribute to the codebase.

## Documentation index

| Document                         | Description                                                                 |
| -------------------------------- | --------------------------------------------------------------------------- |
| [[ARCHITECTURE\|Architecture]]   | Monorepo layout, packages, and how the pipeline fits together               |
| [[CONFIGURATION\|Configuration]] | Project and collection config, schema authoring, sources                    |
| [[CLI\|CLI reference]]           | All commands: `init`, `lint`, `build`, `watch`, `status`, and AI-native ops |
| [[CONTENT-MODEL\|Content model]] | Filename patterns, generated output shape, relations, i18n                  |
| [[API\|Core API]]                | Programmatic API from `@contenz/core/api`                                   |
| [[CODEBASE\|Codebase reference]] | Architecture deep-dive, module map, cleanup items                           |

## Planning and contribution

- [PROJECT_SCOPE.md](../PROJECT_SCOPE.md) – Product direction and scope
- [ROADMAP.md](../ROADMAP.md) – Milestone sequencing
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

See [[CLI|CLI reference]] and [[CONFIGURATION|Configuration]] for full details.
