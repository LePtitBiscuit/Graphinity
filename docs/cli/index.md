# CLI overview

```
graphinity <command> [options]
```

| Command | Purpose |
| ------- | ------- |
| [`init [dir]`](/cli/init) | Create a starter project: `architecture.yml`, a sub-universe in `universes/`, and `assets/icons/` for your own logos. |
| [`dev <file>`](/cli/dev) | Serve the diagram on `127.0.0.1` and reload it when files change. |
| [`validate <file>`](/cli/validate) | Check the configuration and every reference. |
| [`build <file>`](/cli/build) | Generate a static site, deployable on any static host. |

`<file>` is the **root universe** (`.yml`, `.yaml` or `.json`), relative to the current
directory or absolute. `[dir]` (for `init`) is the project directory, the current directory by
default.

New project? Start with:

```sh
npx graphinity init
npx graphinity dev architecture.yml
```

## Options

| Option | Commands | Default | Description |
| ------ | -------- | ------- | ----------- |
| `-p, --port <n>` | `dev` | `4321` | Port of the local server. |
| `--no-open` | `dev` | | Do not open the browser. |
| `-o, --out <dir>` | `build` | `dist` | Output directory, relative to the current directory. |
| `--project <dir>` | `dev`, `validate`, `build` | the file's directory | [Project directory](#the-project-directory). |
| `--force` | `init` | | Overwrite existing files without asking (see [Existing files](/cli/init#existing-files)). |
| `-h, --help` | all | | Show the [help](#help), of a command when given after it. |
| `-v, --version` | | | Show the version. |

An option given to a command it does not apply to is a usage error:

```
✗ --port does not apply to "build".
  Run "graphinity --help" for usage.
```

## Help

`graphinity --help` (or `-h`) prints the general help:

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

`graphinity <command> --help` (or `-h`) prints the help of one command: its usage, arguments,
options, examples, exit codes and the link to its page of this documentation. For example
`graphinity dev --help`:

```
Graphinity 0.1.4 - Interactive nested architecture diagrams

Usage: graphinity dev <file> [options]

Serve the diagram on 127.0.0.1 and reload it when files change.

Arguments:
  <file>               Root architecture file (.yml, .yaml or .json)

Options:
  -p, --port <n>       Port (default 4321, or the next free one)
      --no-open        Do not open the browser
      --project <dir>  Directory referenced files must stay in (default: the file's directory)
  -h, --help           Show this help

Examples:
  graphinity dev architecture.yml
  graphinity dev architecture.yml --port 8080 --no-open

Exit codes: 0 success, 1 invalid configuration or failure, 2 usage error.

Documentation: https://leptitbiscuit.github.io/Graphinity/cli/dev
```

The help of each command is shown on its page: [`init`](/cli/init), [`dev`](/cli/dev),
[`validate`](/cli/validate), [`build`](/cli/build).

## The welcome page

`graphinity` without a command prints a welcome page: the name, the tagline and the version, the
commands, how to get started and the documentation link. At a terminal, the name stands next to
the Graphinity logo, drawn in Braille characters in the violet-to-pink gradient of the logo.
Outside a terminal (a pipe, a log), the logo is left out:

```
  G R A P H I N I T Y
  Interactive nested architecture diagrams

  Version: 0.1.4

  Commands:
    init       Initialize a new Graphinity project
    dev        Start the interactive diagram viewer
    validate   Validate architecture configuration
    build      Generate a static website

  Get started:
    npx graphinity init
    npx graphinity dev architecture.yml

  Options and examples: graphinity --help

  Documentation:
    https://leptitbiscuit.github.io/Graphinity/
```

`graphinity --version` (or `-v`) prints the version alone (`0.1.4`).

## The project directory

Every file the configuration references - sub-universes and local icons - must stay inside the
**project directory**. By default it is the directory of the root file. Use `--project` when your
universes reference files outside it, for example a shared folder next to it:

```
repo/
├── apps/architecture.yml      ← references ../shared/database.yml
└── shared/database.yml
```

```sh
graphinity validate apps/architecture.yml --project .
```

## Exit codes

| Code | Meaning |
| ---- | ------- |
| `0` | Success (warnings may have been printed). |
| `1` | Invalid configuration, or the command failed (for `init`: existing files kept, see [Existing files](/cli/init#existing-files)). |
| `2` | Usage error: unknown command or option, missing file argument, invalid port… |

## Output

- Errors and warnings go to the standard error, results to the standard output.
- Paths in messages are relative to the current directory, so you can open them directly.
- `validate` and `build` print compact lines (no logo), suitable for CI logs. `dev` prints
  `Graphinity <version>  <url>` when the server is ready.

## Colors and the logo

Colors, and the logo of the [welcome page](#the-welcome-page) and of [`init`](/cli/init), are for
people at a terminal:

| Environment | Colors | Logo |
| ----------- | ------ | ---- |
| A terminal | yes | yes |
| Not a terminal (pipe, file, CI log) | no | no |
| `NO_COLOR` set (any non-empty value) | no, always | as without it, in plain characters |
| `FORCE_COLOR` set (non-empty, not `0` or `false`) | yes, even outside a terminal | yes, even outside a terminal |
| `TERM=dumb` | no | at a terminal only, in plain characters |

`NO_COLOR` wins over `FORCE_COLOR` for colors: with both, the logo is shown in plain characters. The outputs shown in this documentation are the plain ones.
