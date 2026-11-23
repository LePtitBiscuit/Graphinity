# Contributing

Graphinity is developed in the open on
[GitHub](https://github.com/LePtitBiscuit/Graphinity). Bug reports, documentation fixes and pull
requests are welcome. The repository's
[`CONTRIBUTING.md`](https://github.com/LePtitBiscuit/Graphinity/blob/main/CONTRIBUTING.md) and
[`AGENTS.md`](https://github.com/LePtitBiscuit/Graphinity/blob/main/AGENTS.md) are the reference
for contributors; this page summarises them.

## Requirements

- **Node.js 22.18 or later** for development. The sources run directly through Node's type
  stripping (`pnpm cli`), and the development tools (Vite 8, Vitest 5) need Node.js 22.12+.
  The published package itself only needs Node.js 22.4.
- **pnpm 12**. The exact version is pinned by the `packageManager` field of `package.json`:
  with Corepack (`corepack enable`) it is selected automatically.
- **Google Chrome**, for the end-to-end tests (Playwright drives the installed browser; no
  browser download).

## Set up

```sh
git clone https://github.com/LePtitBiscuit/Graphinity.git
cd Graphinity
pnpm install
pnpm dev
```

`pnpm dev` starts the viewer with hot reload on the example project
(`examples/kestrel`) and this documentation site, side by side. Each server prints its
address. `GRAPHINITY_FILE=path/to/architecture.yml pnpm dev:viewer` shows another file, and
`GRAPHINITY_PORT=8080 pnpm dev:viewer` (also with `pnpm dev`) serves the viewer on that port
instead of 5173 or the next free one; a taken port is then an error. The `graphinity dev`
command has its own option: [`--port`](/cli/dev).

Both servers also answer through a Cloudflare quick tunnel, to show work in progress to someone
else: `cloudflared tunnel --url http://localhost:<port>`, with the port the server printed. They
accept `<name>.trycloudflare.com` besides `localhost`, and no other host.

## Repository layout

| Folder | Content |
| ------ | ------- |
| `src/core/` | The engine: parse, validate and resolve the YAML/JSON universes, resolve icons. |
| `src/cli/` | The `graphinity` command: `dev`, `validate`, `build`. |
| `viewer/` | The Vue 3 + Vue Flow viewer, precompiled into the package. |
| `examples/` | The Kestrel Logistics example project. |
| `docs/` | This documentation site (VitePress). |
| `tests/`, `e2e/` | Unit tests (Vitest) and end-to-end tests (Playwright). |
| `scripts/` | `check-package.mjs`: checks the packed archive once installed. |

## Commands

```sh
pnpm cli validate examples/kestrel/architecture.yml   # the CLI from the sources
pnpm typecheck      # TypeScript (Node side) and vue-tsc (viewer)
pnpm lint           # unused code (TypeScript compiler checks)
pnpm test           # unit tests
pnpm test:e2e       # build, then browser tests
pnpm build          # dist/core, dist/cli, dist/viewer
pnpm check:package  # pack, install the archive in a temporary project, run every command
pnpm docs:check     # validate every YAML/JSON example of the documentation
pnpm docs:build     # check the examples, build the demo, build the site
pnpm brand          # regenerate the logo files (brand/, favicons) from brand/logo.html
```

A change is ready when `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` and
`pnpm build` pass, and `pnpm docs:build` when the documentation changed. Continuous integration
runs the same checks on every pull request, with the unit tests on Node.js 22, 24 and 26 and the
installed package on Node.js 22.4 (the minimum), 22, 24 and 26.

## Rules for pull requests

- **Files are the only source of truth**: the viewer stays read-only (no editing interface, no
  backend), generated sites never use the network, and configuration files are untrusted input.
- **Update the documentation in the same pull request** as any change a user can notice: this
  site, the relevant `AGENTS.md`, and the `README.md` when what it shows changes (it is a short
  overview that links here). Complete examples are validated by
  `pnpm docs:check`.
- Add tests next to the behaviour, and keep each pull request focused.
- Report security problems privately: see the repository's
  [security policy](https://github.com/LePtitBiscuit/Graphinity/security/policy).
