<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/svg/graphinity-horizontal-light-text.svg">
    <img src="brand/svg/graphinity-horizontal-dark-text.svg" alt="Graphinity" width="420">
  </picture>
</p>

# graphinity

[![CI](https://github.com/LePtitBiscuit/Graphinity/actions/workflows/ci.yml/badge.svg)](https://github.com/LePtitBiscuit/Graphinity/actions/workflows/ci.yml)
[![Documentation](https://github.com/LePtitBiscuit/Graphinity/actions/workflows/docs.yml/badge.svg)](https://leptitbiscuit.github.io/Graphinity/)
[![License: MPL 2.0](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](LICENSE)
[![Node.js >= 22.4](https://img.shields.io/badge/node-%3E%3D22.4-brightgreen.svg)](package.json)

**[Documentation](https://leptitbiscuit.github.io/Graphinity/)** ·
[Live demo](https://leptitbiscuit.github.io/Graphinity/guide/demo) ·
[Docs for AI agents](#for-ai-coding-agents) ·
[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

Interactive, **recursive** architecture diagrams from plain YAML or JSON files.

Describe each level of your system in its own file - an organisation, a platform, a server, its
services - and link them: any node can open the level inside it. `graphinity` validates the
whole hierarchy, lays every level out automatically and serves it as an interactive diagram, or
builds it into a static site.

- **Files are the only source of truth**: no editor, no database, no coordinates to maintain.
- **Recursive universes**: double-click a node to open the universe inside it, at any depth.
- **Search** the nodes and groups of every universe by name, and jump straight to them.
- **Automatic layout** (ELK), with orthogonal connections, labels, groups and tags.
- **Icons**: bundled logos, any [Iconify](https://icon-sets.iconify.design) icon, Dashboard
  Icons or your own images, embedded in the site (it works offline).
- **Live reload** while you edit, with precise errors (file, line, field).
- **Static build** for any static host, without backend.

## Installation

Requires Node.js 22.4 or later.

```sh
npm install --save-dev graphinity
```

The viewer ships precompiled: there is nothing else to install.

## Quick start

```sh
npx graphinity init                 # starter project: architecture.yml, universes/, assets/icons/
npx graphinity dev architecture.yml # opens the diagram, updated on every save
```

Or write the files by hand. One file is one universe; a node's `universe` field opens another file:

```yaml
# architecture.yml - the root universe
id: platform
name: My platform
nodes:
  - id: web
    name: Web app
    icon: vuedotjs
  - id: api
    name: API
    icon: nodedotjs
    description: REST API and background jobs.
    universe: ./api.yml # double-click this node to open api.yml
connections:
  - from: web
    to: api
    label: HTTPS
```

```yaml
# api.yml - the universe inside the "API" node
id: api
name: API
nodes:
  - id: server
    name: Server
    icon: nodedotjs
  - id: db
    name: PostgreSQL
    icon: postgresql
connections:
  - from: server
    to: db
    label: SQL
```

JSON works the same way (`.json` files, mixed freely with YAML). Next steps: the
[quick start guide](https://leptitbiscuit.github.io/Graphinity/guide/quick-start) and the
[configuration overview](https://leptitbiscuit.github.io/Graphinity/config/).

## Commands

| Command | What it does | Main options |
| ------- | ------------ | ------------ |
| `graphinity init [dir]` | Creates a starter project; never overwrites a file without asking. | `--force` |
| `graphinity dev <file>` | Serves the diagram on `127.0.0.1` and reloads it when a file changes. | `-p, --port <n>` (default 4321), `--no-open`, `--project <dir>` |
| `graphinity validate <file>` | Checks every file and reference, reports every error at once. Useful in CI. | `--project <dir>` |
| `graphinity build <file>` | Generates a static site (serve it over HTTP, from any sub-path). | `-o, --out <dir>` (default `dist`), `--project <dir>` |

Exit codes: `0` success, `1` invalid configuration or failure, `2` usage error.
`graphinity <command> --help` prints the help of a command; see the
[CLI reference](https://leptitbiscuit.github.io/Graphinity/cli/).

## Documentation

The full documentation is at **https://leptitbiscuit.github.io/Graphinity/**.

| Topic | Pages |
| ----- | ----- |
| Getting started | [Installation](https://leptitbiscuit.github.io/Graphinity/guide/installation), [Quick start](https://leptitbiscuit.github.io/Graphinity/guide/quick-start), [Live demo](https://leptitbiscuit.github.io/Graphinity/guide/demo) |
| Concepts | [Universes](https://leptitbiscuit.github.io/Graphinity/concepts/universes), [Sub-universes and navigation](https://leptitbiscuit.github.io/Graphinity/concepts/sub-universes), [File structure](https://leptitbiscuit.github.io/Graphinity/concepts/file-structure), [Automatic layout](https://leptitbiscuit.github.io/Graphinity/concepts/layout) |
| Configuration reference | [Overview](https://leptitbiscuit.github.io/Graphinity/config/), [Universe](https://leptitbiscuit.github.io/Graphinity/config/universe), [Node](https://leptitbiscuit.github.io/Graphinity/config/node), [Connection](https://leptitbiscuit.github.io/Graphinity/config/connection), [Group](https://leptitbiscuit.github.io/Graphinity/config/group), [Tags](https://leptitbiscuit.github.io/Graphinity/config/tags), [Icons](https://leptitbiscuit.github.io/Graphinity/config/icons), [Colors and styles](https://leptitbiscuit.github.io/Graphinity/config/colors-and-styles) |
| Validation | [Validation rules and limits](https://leptitbiscuit.github.io/Graphinity/config/validation), [Common errors](https://leptitbiscuit.github.io/Graphinity/cli/errors) |
| Examples | [Complete examples](https://leptitbiscuit.github.io/Graphinity/config/examples), [guides](https://leptitbiscuit.github.io/Graphinity/guides/simple-diagram), the [Kestrel Logistics project](examples/kestrel) |
| Deployment | [Build and host a static site](https://leptitbiscuit.github.io/Graphinity/guides/static-hosting) |
| Reference | [Viewer](https://leptitbiscuit.github.io/Graphinity/reference/viewer), [Programmatic API](https://leptitbiscuit.github.io/Graphinity/reference/api), [Security](https://leptitbiscuit.github.io/Graphinity/reference/engine#security), [Limitations](https://leptitbiscuit.github.io/Graphinity/reference/limitations) |

## For AI coding agents

The documentation is published as plain Markdown, generated from the same pages on every build
([details](https://leptitbiscuit.github.io/Graphinity/reference/llms)):

- [`llms.txt`](https://leptitbiscuit.github.io/Graphinity/llms.txt): an index of every page with a
  one-line summary, starting with the pages to read first (configuration, validation, CLI,
  examples).
- [`llms-full.txt`](https://leptitbiscuit.github.io/Graphinity/llms-full.txt): the whole
  documentation in one file.
- Any page as Markdown: add `.md` to its URL
  ([`/config/node.md`](https://leptitbiscuit.github.io/Graphinity/config/node.md)).

Every complete example of the documentation is validated against the engine when the site is
built. Check generated files with `npx graphinity validate architecture.yml`: it reports every
error with its file, line and field. Agents changing this repository read [`AGENTS.md`](AGENTS.md)
first.

## Development

```sh
pnpm install
pnpm dev     # the viewer (hot reload, on examples/kestrel) and the documentation site
pnpm test    # unit tests; see CONTRIBUTING.md for every check
```

Development needs Node.js 22.18 or later and pnpm 12. See [`CONTRIBUTING.md`](CONTRIBUTING.md)
for the workflow and the rules for pull requests.

## License

[Mozilla Public License 2.0](LICENSE). A built site contains the viewer, whose `index.html` keeps
a comment naming the license and the source code address. Icon collections keep their own
licenses (Simple Icons and SVG Logos: CC0-1.0; Devicon and VSCode Icons: MIT; Dashboard Icons:
Apache-2.0 - texts in [`licenses/`](licenses); other Iconify collections: see each collection,
credited in the `icons/ATTRIBUTIONS.md` of every built site); the brands the logos represent
remain the property of their owners.
