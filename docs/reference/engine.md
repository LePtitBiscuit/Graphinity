# How the engine works

The engine (`src/core` in the repository) turns configuration files into normalized,
JSON-serializable data. The CLI and the [programmatic API](/reference/api) both use it.

## Pipeline

1. **Resolve the project.** The project directory is the root file's directory, or the one given
   with `--project` (`projectRoot` in the API), resolved through symbolic links.
2. **Read and parse each file** (`.yml`/`.yaml` with a YAML parser, `.json` with a strict JSON
   parser). Files over 1 MB are refused. Parsing keeps the position of every value, to report
   errors with a line and a column.
3. **Validate the file** against the schema: known properties only, types, lengths, ids, and
   references inside the file (connections, groups, tags).
4. **Resolve references**: local `icon` paths and `universe` paths, relative to the file, checked
   to stay inside the project.
5. **Discover sub-universes** breadth-first: each file is loaded once, even if several nodes open
   it. A file with errors still has its valid nodes followed, so a single run reports every
   problem of the project.
6. **Check the whole project**: universe ids are unique; no universe leads back to one of its
   ancestors (the error shows the chain); connection ends that are paths into sub-universes
   (`checkout/api`) lead to a node of the universe reached.
7. **Normalize**: every universe gets its defaults (`direction: right`, `groups: []`,
   `edges: []` - the `connections` of the file), the background image path is resolved, colors become lowercase `#rrggbb`/`#rrggbbaa`, tags get their corner, icons
   become `{ type: 'name' }` or `{ type: 'file' }`, and a node's `universe` becomes the **id** of
   the universe it opens. Connections get ids (`e0`, `e1`… in file order).
8. **Resolve the named icons** (for the viewer): each distinct icon reference is resolved once,
   by the provider of its collection. Simple Icons become path data; the other icons become SVG
   files of the site, named after their content, validated, and written once even when several
   references lead to the same icon. Icons that are not found produce warnings. The credits and
   license texts of the collections used are added. See [Icons](/config/icons).

The viewer then lays out each universe when it is opened (see [Viewer](/reference/viewer)).

## Errors

Problems are never thrown: they are collected as errors with a `file` (relative to the project),
a `field` (`nodes[2].universe`), a `message`, and a `line` and `column` when known. Each error only
leaves out the element it concerns, and the normalized architecture is built from everything
valid ([details](/config/validation#when-there-are-errors)); the `dev` server shows it,
`validate` and `build` refuse it. An invalid
element produces one error, not one per reference to it: a node with a valid `id` but another
invalid property stays known to the connections that use it.

## Security

Configuration files are treated as **untrusted data**:

- **Data only.** No code is executed. YAML tags (`!!js/function`, custom tags) are rejected,
  duplicate keys and multiple documents too, and alias expansion is limited. `__proto__`-like keys
  cannot pollute anything: ids must start with a letter or a digit, and lookups only use own
  properties.
- **Validated SVG.** Every SVG - local, downloaded or bundled - is checked to contain no script,
  event handler, foreign content or external reference before it is used.
- **Downloads are data only.** Icons of Iconify collections that are not bundled come from the
  official Iconify API hosts only, as JSON icon data checked field by field; Dashboard Icons are
  SVG files from the collection's repository, pinned to one commit. Everything is validated and
  cached, at build time only. No code is downloaded or executed.
- **Confined file access.** Paths must be relative. They are checked to stay inside the project
  directory *before* the disk is touched, then again after resolving symbolic links. Only files
  with an expected extension are read.
- **Validated values only reach the viewer.** Colors are hexadecimal or palette names; styles are
  fixed values. The viewer never injects markup: brand logos are drawn from SVG path data, local
  icons are displayed through `<img>` (SVG scripts never run there), and the built page has a
  strict Content Security Policy and loads nothing from other origins.
- **The dev server** listens on `127.0.0.1` only, answers only requests addressed to it (or through
  a Cloudflare quick tunnel, `*.trycloudflare.com`), and only serves the viewer and the files referenced by the architecture.
