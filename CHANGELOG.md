# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Programmatic API** (`content-tools/api`): `runLint`, `runBuild`, and `loadProjectConfig` for use in scripts and build pipelines.
- **Config fallback**: Project config can be `content.config.ts`, `content.config.mjs`, or `content.config.js` (first found wins).
- **Parallelism**: Lint and build process collections in parallel (using `p-map` with concurrency 4).
- **Istanbul coverage**: `npm run test:coverage` for Vitest with Istanbul provider.
- **ESLint**: `npm run lint` with typescript-eslint and Prettier compatibility.
- **Prettier**: `npm run format` and `npm run format:check` for consistent formatting.

### Changed

- CLI commands now delegate to shared `runLint` / `runBuild`; behavior is unchanged.

[Unreleased]: https://github.com/your-org/content-tools/compare/v0.1.0...HEAD
