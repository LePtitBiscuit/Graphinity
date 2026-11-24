# `build`

```sh
graphinity build <file> [--out <dir>] [--project <dir>]
```

Generates a standalone static site: the viewer, the data of every universe, the icons used and
the local images.

```
$ graphinity build architecture.yml
✓ Built 3 universes, 12 nodes, 8 connections → dist/ (10 files)
  Serve it with any static HTTP server, e.g. npx serve dist
```

## Options

| Option | Default | Description |
| ------ | ------- | ----------- |
| `-o, --out <dir>` | `dist` | Output directory, relative to the current directory. |
| `--project <dir>` | the file's directory | [Project directory](/cli/#the-project-directory). |

## Output

```
dist/
├── index.html            the viewer
├── favicon.svg           its icon (the Graphinity logo)
├── assets/               its scripts and styles
├── architecture.json     every universe, validated and resolved, with the logos used
├── files/                local images, under their path in the project
├── icons/                icons of the collections used (one SVG file per distinct icon)
│   ├── ATTRIBUTIONS.md   credits of the collections used
│   └── licenses/         license texts required to redistribute them
└── .graphinity  marker: this directory was generated
```

Only the icons the diagram uses are included, never whole collections - see
[How icons reach the viewer](/config/icons#how-icons-reach-the-viewer). Keep `icons/ATTRIBUTIONS.md`
and `icons/licenses/` when you publish the site.

The site needs no backend, makes no network request, and works from any path of a host (`https://example.com/docs/arch/`).
It must be served over HTTP: browsers do not run it from `file://`.
See [Build and host a static site](/guides/static-hosting).

## The output directory is protected

The output directory is **replaced** on every build - but only when it is safe:

- a directory created by a previous build (it contains `.graphinity`) is emptied and
  rebuilt;
- a **non-empty directory created by something else is never touched**:

  ```
  ✗ /home/me/project/dist is not empty and was not created by graphinity. Remove it or choose another --out.
  ```

- an output directory that would contain the project directory or the current directory is
  refused.

If the configuration has errors, they are printed (exit code `1`) and nothing is written: unlike
[`dev`](/cli/dev#errors-do-not-stop-the-server), `build` never publishes a partial diagram.

## Help

`graphinity build --help` prints:

```
Graphinity 0.1.2 - Interactive nested architecture diagrams

Usage: graphinity build <file> [options]

Generate a static site, deployable on any static host.

Arguments:
  <file>               Root architecture file (.yml, .yaml or .json)

Options:
  -o, --out <dir>      Output directory (default dist)
      --project <dir>  Directory referenced files must stay in (default: the file's directory)
  -h, --help           Show this help

Examples:
  graphinity build architecture.yml
  graphinity build architecture.yml --out site

Exit codes: 0 success, 1 invalid configuration or failure, 2 usage error.

Documentation: https://leptitbiscuit.github.io/Graphinity/cli/build
```
