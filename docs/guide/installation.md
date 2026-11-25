# Installation

## Requirements

- **Node.js 22.4 or later** (tested on the LTS lines 22, 24 and 26).
- A modern browser to look at the diagrams.

The package ships its viewer precompiled: you do not need to install Vue, Vite or anything else.
Its runtime dependencies are `yaml` (the YAML parser) and the icon collections: `simple-icons`,
`@iconify-json/devicon`, `@iconify-json/logos` and `@iconify-json/vscode-icons`. Generated sites
never need network access. Building a diagram only needs it to download, the first time they are
used, icons of the other [Iconify collections](/config/icons#any-iconify-collection) and
[Dashboard Icons](/config/icons#dashboard-icons).

## Install the package

```sh
npm install --save-dev graphinity
```

Or run it without installing, starting with a [starter project](/cli/init):

```sh
npx graphinity init
npx graphinity dev architecture.yml
```

### From a package archive

To try an unreleased version, clone the [repository](https://github.com/LePtitBiscuit/Graphinity) and build the archive (this
builds the engine, the CLI and the viewer first). Building needs Node.js 22.18 or later and pnpm
(see [Contributing](/project/contributing#requirements)):

```sh
git clone https://github.com/LePtitBiscuit/Graphinity.git
cd Graphinity
pnpm install
npm pack
```

This creates `graphinity-<version>.tgz`. Install it in your own project:

```sh
npm install --save-dev /path/to/graphinity-<version>.tgz
npx graphinity --version
```

### From the repository, without installing

The CLI also runs directly from the sources:

```sh
pnpm install
pnpm build                       # the viewer must be built once
pnpm cli dev path/to/architecture.yml
```

## Check the installation

```sh
npx graphinity --help
```

prints:

```
Graphinity 0.1.4 - Interactive nested architecture diagrams

Usage: graphinity <command> [options]

Commands:
  init [dir]        Create a starter project (architecture.yml, universes/, assets/icons/)
  dev <file>        Serve the diagram on 127.0.0.1 and reload it when files change
  validate <file>   Check the configuration and every reference
  build <file>      Generate a static site, deployable on any static host

Options:
  -h, --help        Show this help, or a command's: graphinity <command> --help
  -v, --version     Show the version

Examples:
  graphinity init
  graphinity dev architecture.yml
  graphinity validate architecture.yml
  graphinity build architecture.yml --out site

Exit codes: 0 success, 1 invalid configuration or failure, 2 usage error.

Documentation: https://leptitbiscuit.github.io/Graphinity/
```

`npx graphinity` alone prints a [welcome page](/cli/#the-welcome-page) (with the logo at a
terminal), and `npx graphinity <command> --help` the help of one command.

Next: [Quick start](/guide/quick-start), or create a starter project right away with
[`npx graphinity init`](/cli/init).
