# Contributing to Graphinity

Thank you for helping. Bug reports, documentation fixes and pull requests are all welcome.

## Before you start

- Read [`AGENTS.md`](AGENTS.md): it describes the architecture, the principles that must not be
  broken (the files are the only source of truth, the viewer is read-only, no network at runtime,
  configuration is untrusted input) and the conventions. Then read the `AGENTS.md` of the folder
  you change (`src/core/`, `src/cli/`, `viewer/`, `examples/`, `docs/`).
- For a large change or a new configuration field, open an issue first to agree on the design.
- Never report a security vulnerability in a public issue: see [`SECURITY.md`](SECURITY.md).

## Setup

Requirements:

- **Node.js 22.18 or later** for development (the sources run directly through Node's type
  stripping; Vite 8 and Vitest 5 need 22.12+). Users of the published package only need 22.4.
- **pnpm 12** - the exact version is pinned in `package.json` (`packageManager`); with Corepack
  (`corepack enable`) or pnpm's own version management it is selected automatically.
- **Google Chrome** for the end-to-end tests (Playwright uses the installed browser).

```sh
git clone https://github.com/LePtitBiscuit/Graphinity.git
cd Graphinity
pnpm install
pnpm dev            # viewer (hot reload, on examples/kestrel) and documentation site
```

## Commands

```sh
pnpm cli validate examples/kestrel/architecture.yml   # the CLI from the sources
pnpm typecheck      # TypeScript (Node side) and vue-tsc (viewer)
pnpm lint           # unused code (TypeScript compiler checks)
pnpm test           # unit tests (Vitest)
pnpm test:e2e       # build, then browser tests (Playwright, installed Google Chrome)
pnpm build          # dist/core, dist/cli, dist/viewer
pnpm check:package  # npm pack, install the archive in a temporary project, run every command
pnpm docs:build     # check the documentation examples, build the demo and the site
pnpm brand          # regenerate the logo files (brand/, favicons) from brand/logo.html
```

A change is ready when `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` and
`pnpm build` pass, and `pnpm docs:build` when the documentation changed. CI runs the same checks
on every pull request, on Node.js 22, 24 and 26.

## Pull requests

- Keep each pull request focused on one change; do not mix refactoring with behaviour changes.
- **Update the documentation in the same pull request** as any change a user can notice: the
  documentation site (`docs/`), `README.md`, and the relevant `AGENTS.md` (see the table in
  `AGENTS.md`). Every YAML/JSON example must be valid (`pnpm docs:check`).
- Add or update tests next to the behaviour (`tests/` mirrors `src/` and `viewer/src/`). Build
  test fixtures with `tests/helpers.ts` instead of relying on `examples/`.
- Code, comments and messages are in English. TypeScript stays on 6.x (`vue-tsc` requirement).
- Do not add runtime dependencies, a backend, an editing feature or a CDN dependency in the
  viewer.
- Do not change the package version: releases are made by the maintainer.

## License

Graphinity is licensed under the [Mozilla Public License 2.0](LICENSE). By contributing, you agree
that your contributions are licensed under the same license.
