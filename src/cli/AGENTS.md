# AGENTS.md - src/cli (command line)

The `graphinity` binary (`dist/cli/index.js`). Read the [root guide](../../AGENTS.md)
first.

## Files

| File          | Role |
| ------------- | ---- |
| `index.ts`    | Argument parsing (`node:util` `parseArgs`), options allowed per command (`COMMAND_OPTIONS`), dispatch, exit codes, the terminal side of `init` (confirmation prompt, messages), browser opening. |
| `help.ts`     | What the CLI prints about itself: the welcome page (no command), the general help (`--help`), the help of each command (`<command> --help`), from `COMMANDS`; `DEFAULT_PORT`, `DEFAULT_OUT`. |
| `brand.ts`    | Terminal branding: when to use colors (`colorEnabled`: `NO_COLOR`, `FORCE_COLOR`, `TERM=dumb`) and the logo (`showLogo`), the logo rasterized in Braille characters with its violet-to-pink gradient, `TAGLINE`, the documentation URL (`docsUrl`, from `package.json` `homepage`). |
| `init.ts`     | `init`: the starter files (`starterFiles()`, `STARTER_DIRS`) and `initProject` (conflict detection, staged writes, rollback). |
| `validate.ts` | `validate`: errors (exit 1) or summary and icon warnings (exit 0). |
| `build.ts`    | `build`: static site into `--out`, with output-directory safety checks. |
| `dev.ts`      | `dev`: local HTTP server, file watching, live reload through server-sent events. |
| `site.ts`     | What dev and build share: location of the precompiled viewer, site layout constants, local icon files, summary, content types. |
| `output.ts`   | Terminal output: colors per `brand.ts` (`colorEnabled`); error paths relative to the working directory. |

## Contracts

- **Site layout** (served by `dev`, written by `build`, read by the viewer): `index.html` and
  `assets/` (the viewer), `architecture.json` (`ViewerData`), `files/<project-relative path>` (local
  images), `icons/` (the `files` of the `ViewerBundle`: SVG icons of collections,
  `ATTRIBUTIONS.md`, `licenses/`; served from memory by `dev`). `dev` adds a `<meta name="graphinity:live">` pointing to `__events`. Changing
  this layout means changing `viewer/src/App.vue` and README › *Deployment*.
- **Exit codes**: `0` success, `1` invalid configuration or failure (including `init` keeping
  existing files: declined, or not a terminal without `--force`), `2` usage error.
- **Options** are declared once in `parseArgs` and allowed per command in `COMMAND_OPTIONS`
  (`init`: `force`; `dev`: `port`, `open`, `project`; `validate`: `project`; `build`: `out`,
  `project`). `--help`/`-h` and `--version`/`-v` work everywhere. Keep `COMMANDS` in `help.ts`
  (usage, arguments, options, examples, documentation page) in sync with `COMMAND_OPTIONS`, and
  both with README › *Commands* and `docs/cli/` (the help outputs shown there are copied from the
  real CLI).
- **`init` writes** `architecture.yml`, `universes/example.yml` (the content of `starterFiles()`,
  copied in `docs/cli/init.md`) and the folders `universes/`, `assets/icons/`. The starter files
  use only bundled icons (Simple Icons names): they must validate offline.

## Rules

- `dev` listens on `127.0.0.1` only, answers only requests whose `Host` is the local server or a
  Cloudflare quick tunnel (`TUNNEL_HOST`, `<name>.trycloudflare.com`: Cloudflare's DNS cannot point
  at 127.0.0.1) - DNS rebinding -, serves only the viewer directory and the icon files referenced by the current
  architecture, and never stops on a configuration error: it serves the partial architecture
  with `errors` (HTTP 200), or only the errors (HTTP 422) when the root cannot be read. `validate`
  and `build` stay strict.
- Icons are resolved on every reload through the shared `defaultIconProviders()` (in-memory
  memo): only new references are downloaded. `DevServerOptions.iconProviders` injects providers
  for tests.
- `build` never empties a directory it did not create (marker file `.graphinity`), and
  refuses an output that contains the project, the working directory or the viewer.
- **Colors and the logo** only at a terminal: `NO_COLOR` disables colors (the logo is then plain),
  `FORCE_COLOR` styles non-terminal output and shows the logo, `TERM=dumb` disables colors. The
  logo is for the welcome page and `init` only: `validate` and `build` stay compact (CI logs),
  `dev` prints one `Graphinity <version>  <url>` line.
- **`init` never overwrites without consent**: at a terminal (stdin and stdout) it asks
  `Overwrite? (y/N)`; elsewhere it writes nothing and exits `1` unless `--force`. A folder where a
  file goes (or the reverse) is an error even with `--force`. Writes are staged: each file is
  written next to its target (`flag: 'wx'`), then all are renamed into place; on failure the
  staged files and the folders created by the run are removed.
- The CLI imports the engine through `../core/index.ts` only.
- Tests: `tests/cli/*.test.ts` call `startDevServer`/`buildSite` with a fake viewer directory and
  port `0`, and `initProject` in temporary directories; `tests/package.test.ts` runs the CLI as a process from another directory.
