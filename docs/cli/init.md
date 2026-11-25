# `init`

```sh
graphinity init [dir] [--force]
```

Creates a starter project: a root universe, a sub-universe it opens, and a folder for your own
logos. It is the fastest way to start:

```sh
npx graphinity init
npx graphinity dev architecture.yml
```

`dir` is the project directory, relative to the current directory or absolute. Without it, the
project is created in the current directory. A missing directory is created, with its parents
(`graphinity init docs/architecture` works in an empty repository).

## What it creates

```
.
├── architecture.yml        ← root universe "My system": web, api, database
├── universes/
│   └── example.yml         ← universe "API", opened by the "api" node
└── assets/
    └── icons/              ← empty: your own SVG logos
```

| Path | Role |
| ---- | ---- |
| `architecture.yml` | The [root universe](/concepts/universes) *My system*, left to right: a web app, an API that opens `universes/example.yml`, and a database. Its connections go [into the sub-universe](/config/connection#connecting-to-a-sub-universe) by path: `web` → `api/server`, `api/worker` → `database`. |
| `universes/example.yml` | The universe *API*, top to bottom: a server, a job queue and a worker. |
| `assets/icons/` | An empty folder for your own SVG logos, used by path (`icon: ./assets/icons/database.svg`, see [local images](/config/icons#local-images)). |

The icons are [Simple Icons](/config/icons#simple-icons) logos bundled with the package:
the project works offline, nothing is downloaded. Comments in the files explain each part, and
`graphinity validate architecture.yml` prints `✓ Valid: 2 universes, 6 nodes, 4 connections`.

The generated files are:

```yaml [architecture.yml]
# The root universe of your architecture. Every file describes one level (a universe):
# its nodes, groups and connections. A node opens another level with "universe" -
# double-click it in the viewer.
# Documentation: https://leptitbiscuit.github.io/Graphinity/
id: my-system
name: My system
direction: right
nodes:
  - id: web
    name: Web app
    icon: vuedotjs
    description: What your users open.
  - id: api
    name: API
    icon: nodedotjs
    description: Double-click to open its universe.
    universe: ./universes/example.yml
  - id: database
    name: Database
    icon: postgresql
    # Your own logos: put SVG files in assets/icons/ and use them by path, e.g.
    # icon: ./assets/icons/database.svg
connections:
  # "api/server": the node "server" inside the universe opened by "api".
  - from: web
    to: api/server
    label: HTTPS
  - from: api/worker
    to: database
    label: SQL
```

```yaml [universes/example.yml]
# A sub-universe: what is inside the "API" node of architecture.yml.
id: api
name: API
direction: down
nodes:
  - id: server
    name: Server
    icon: nodedotjs
    description: Answers the web app.
  - id: queue
    name: Job queue
    icon: redis
  - id: worker
    name: Worker
    icon: nodedotjs
    description: Runs the jobs.
connections:
  - from: server
    to: queue
    label: jobs
  - from: queue
    to: worker
```

## Options

| Option | Description |
| ------ | ----------- |
| `--force` | Overwrite `architecture.yml` and `universes/example.yml` if they exist, without asking. |
| `-h, --help` | Show the help of `init`. |

## Output

```
$ graphinity init
✓ Graphinity project initialized successfully!

Created:
  architecture.yml
  universes/example.yml
  assets/icons/

Next steps:

  1. Edit architecture.yml to define your nodes.
  2. Run: npx graphinity dev architecture.yml
  3. Read the documentation:
     https://leptitbiscuit.github.io/Graphinity/
```

With a directory, the paths include it:

```
$ graphinity init my-architecture
✓ Graphinity project initialized successfully!

Created:
  my-architecture/architecture.yml
  my-architecture/universes/example.yml
  my-architecture/assets/icons/

Next steps:

  1. Edit my-architecture/architecture.yml to define your nodes.
  2. Run: npx graphinity dev my-architecture/architecture.yml
  3. Read the documentation:
     https://leptitbiscuit.github.io/Graphinity/
```

Only what did not exist is listed under `Created:` (an `assets/icons/` folder that was already
there is kept and not listed); replaced files are listed under `Overwritten:`. At a terminal, the
output starts with the Graphinity logo and `Initializing a new project...`, and is colored (see
[Colors and the logo](/cli/#colors-and-the-logo)).

## Existing files

`init` never overwrites a file silently. When `architecture.yml` or `universes/example.yml`
already exists:

- **At a terminal**, it asks:

  ```
  ? architecture.yml, universes/example.yml already exist in the current directory. Overwrite? (y/N)
  ```

  `y` (or `yes`) overwrites them. Any other answer, or just Enter, writes nothing:

  ```
  ✗ Nothing was written: architecture.yml, universes/example.yml kept as they are.
  ```

- **Outside a terminal** (CI, pipes, scripts), it does not ask: it writes nothing and fails:

  ```
  ✗ architecture.yml, universes/example.yml already exist in the current directory. Nothing was written.
    Run "graphinity init --force" to overwrite, or choose another directory: graphinity init <dir>
  ```

- **With `--force`**, it overwrites them without asking.

Both cases where nothing was written exit with code `1`. Other files of the directory are never
touched, and the `universes/` and `assets/icons/` folders are kept if they exist.

A folder where `init` writes a file, or a file where it needs a folder, is an error (exit code
`1`), even with `--force`:

```
✗ "architecture.yml" is a directory: move it away first.
```

```
✗ "universes" is a file, not a directory: move it away first.
```

Files are written next to their target first, then moved into place: if writing fails (a full
disk, a permission error), nothing is left half-written, and the folders created by this run are
removed.

## Exit codes

| Code | Meaning |
| ---- | ------- |
| `0` | The project was created. |
| `1` | Nothing was written: existing files kept (answer *no*, or outside a terminal without `--force`), a folder or file in the way, or writing failed. |
| `2` | Usage error: an option of another command (`✗ --port does not apply to "init".`), or more than one directory (`✗ Unexpected argument "b".`). |

## Help

`graphinity init --help` prints:

```
Graphinity 0.1.3 - Interactive nested architecture diagrams

Usage: graphinity init [dir] [options]

Create a starter project: architecture.yml, a sub-universe in universes/, and
assets/icons/ for your own logos. Existing files are never overwritten without a
confirmation (or --force).

Arguments:
  [dir]                Project directory, created if missing (default: the current directory)

Options:
      --force          Overwrite existing files without asking
  -h, --help           Show this help

Examples:
  graphinity init
  graphinity init my-architecture

Exit codes: 0 success, 1 invalid configuration or failure, 2 usage error.

Documentation: https://leptitbiscuit.github.io/Graphinity/cli/init
```

## Next steps

1. Edit `architecture.yml`: rename the universe, replace the nodes with yours (see
   [Nodes](/concepts/nodes) and the [configuration reference](/config/)).
2. Preview it with [`graphinity dev architecture.yml`](/cli/dev): the page updates every time you
   save.
3. Add a level: create a file in `universes/` and point a node to it with
   [`universe`](/concepts/sub-universes).
4. Check it in CI with [`validate`](/cli/validate), and publish it with [`build`](/cli/build).
