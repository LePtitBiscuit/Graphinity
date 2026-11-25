# Common errors

The messages below are the exact output of the CLI. Each error gives `file:line:column field`,
so you can jump to the problem.

## A referenced file does not exist

```
architecture.yml:7:15 nodes[0].universe: File not found: "./api.yml"
```

The path in `universe` (or in a local `icon`) is relative to **the file that contains it**.
Check the spelling and the folder.

## A file is outside the project

```
architecture.yml:7:15 nodes[0].universe: "../shared/a.yml" is outside the project directory
```

Referenced files must stay in the project directory - by default, the root file's directory.
Move the file, or widen the project with [`--project`](/cli/#the-project-directory).

## Circular reference

```
sub.yml:7:15 nodes[0].universe: Circular universe reference: architecture.yml → sub.yml → architecture.yml
```

A universe leads back to a universe that leads to it. Remove the `universe` field that closes
the loop: to go back up, use the breadcrumb.

## Connection to an unknown node or group

```
architecture.yml:9:9 connections[0].to: Unknown node or group "api" (connections must reference nodes or groups of the same universe)
```

`from` and `to` take node or group **ids** of the same universe - or a
[path](/config/connection#connecting-to-a-sub-universe) into the sub-universe of one of them
(`checkout/api`). A connection cannot reach a node of a parent or unrelated universe: add a node for
the other side.

## Connection to what a group holds

```
architecture.yml:21:5 connections[2]: Group "cloud" holds node "api": a connection cannot link a group to what is inside it
```

A connection to a [group](/config/connection#connecting-groups) attaches to its frame: its other
end must be outside the group. Connect the node inside instead, or a group next to it.

## `edges` was renamed

```
architecture.yml:9:1 edges: "edges" was renamed to "connections"
```

The list of connections of a universe is now called `connections`. Rename the key: nothing else
changes.

```yaml
connections:        # was: edges
  - from: web
    to: api
```

## Path into a sub-universe

```
architecture.yml:104:9 connections[0].to: Node "stripe" does not open a universe ("stripe/x")
architecture.yml:120:11 connections[5].from: Unknown node or group "apii" in universe "checkout" ("platform/eu-west/checkout/apii")
```

A [path](/config/connection#connecting-to-a-sub-universe) `node/inner` must start with a node
that opens a universe, and every next id must be a node of the universe reached; the last one may
also be a [group](/config/connection#a-group-of-a-sub-universe) of that universe. When a
sub-universe has its own errors (missing file, syntax error…), its nodes cannot be reached either:
`The universe of "routing" is not available ("routing/api")`.

## Nodes side by side

```
architecture.yml:24:13 connections[3].align: "a" (outside any group) and "b" (in group "g") cannot be side by side: only nodes of the same group can be aligned
architecture.yml:12:13 nodes[4].beside: A node takes one placement hint: "after" is already set (use one of place, after, beside)
```

[`align: true`](/config/connection#side-by-side) links two different nodes of this universe, in
the same group (or both outside any group): not a group, not a path into a sub-universe. A node
placed [`beside`](/config/node#side-by-side) another one follows the same rule, and takes only
one placement hint. The connection is still drawn (without `align`), the node keeps its computed
place. Other messages: `"align" keeps two nodes side by side: its ends must be nodes of this
universe, not groups or paths into sub-universes`, `A connection from a node to itself cannot be
aligned ("a")`, `A node cannot be placed beside itself ("c")`.

## Groups inside groups

```
architecture.yml:9:12 groups[1].group: Groups inside each other: region → azure → region
architecture.yml:14:12 groups[2].group: Group "vnet" cannot be inside itself
architecture.yml:30:12 groups[6].group: Group "subnet" is nested too deep: azure → region → vnet → zone → subnet (max 4 levels)
```

A group's [`group`](/config/group#groups-inside-groups) must name another declared group, without
going round in a circle, and groups nest 4 levels deep at most. The group is then drawn at the top
level, outside the frame it named.

## Unknown field

```
architecture.yml:7:17 nodes[0].descripton: Unknown field "descripton" (allowed: id, name, icon, description, universe, group, tags, color, border, background, size)
```

Usually a typo; the message lists what is allowed.

## A number where a text is expected

```
architecture.yml:5:11 nodes[0].name: "name" must be a string, got number
```

YAML reads `name: 2024` as a number. Quote it: `name: "2024"`.

## Same universe id in two files

```
sub.yml:1:5 id: Universe id "root" is already used by architecture.yml
```

Universe ids are unique in the whole project.

## YAML syntax error

```
architecture.yml:5:1: Invalid YAML: Sequence item without - indicator
```

Usually an indentation problem: the properties of a node must be aligned under its first one.

## Invalid color

```
architecture.yml:7:12 nodes[0].color: "color" must be a hex color (#4f8cff) or one of gray, white, blue, teal, green, yellow, orange, red, pink, purple, got "rgb(1,2,3)"
```

See [Colors](/config/colors-and-styles#colors). Remember to quote hexadecimal colors in YAML.

## Invalid icon reference

```
architecture.yml:6:11 nodes[0].icon: Invalid icon "my_set:react": "my_set" is not a collection prefix (lowercase letters, digits and single hyphens, e.g. "mdi", "simple-icons")
```

A named icon is `name` or `prefix:name`, where the prefix is an
[Iconify collection](/config/icons#any-iconify-collection) (or `dashboard`): lowercase letters
and digits separated by single hyphens. Copy references from
[icon-sets.iconify.design](https://icon-sets.iconify.design).

## Unsafe local SVG

```
architecture.yml:9:11 nodes[1].icon: Invalid SVG "./icons/unsafe.svg": it contains a script
```

Local SVG icons must not contain scripts, event handlers or external references - see
[SVG validation](/config/icons#svg-validation). Export the logo again as a plain SVG.

## Icon not found (warning)

```
warning architecture.yml nodes[0].icon: Icon "not-a-brand" (Simple Icons): not found. The generic icon is shown.
```

Not an error: the node gets a generic icon. Check the name in its collection
([Icons](/config/icons#bundled-collections), [icon-sets.iconify.design](https://icon-sets.iconify.design)),
or use a [local image](/config/icons#local-images). The same warning reports a collection that
does not exist:

```
warning architecture.yml nodes[0].icon: Icon "logo:react" (Iconify logo): no Iconify collection is named "logo" (see https://icon-sets.iconify.design). The generic icon is shown.
```

## Icon not downloaded (warning)

```
warning ok.yml nodes[0].icon: Icon "mdi:database" (Iconify mdi): download failed (fetch failed (ENOTFOUND); check your network connection). The generic icon is shown.
warning ok.yml nodes[1].icon: Icon "dashboard:jellyfin" (Dashboard Icons): download failed (getaddrinfo ENOTFOUND cdn.jsdelivr.net); check your network connection. The generic icon is shown.
```

Icons of [Iconify collections](/config/icons#any-iconify-collection) that are not bundled, and
[Dashboard Icons](/config/icons#dashboard-icons), are downloaded the first time they are used.
Connect to the network and build again; once downloaded, they are cached. With
`GRAPHINITY_OFFLINE=1`, the reason is `not in the icon cache, and downloads are disabled`.

## Collection license to check (warning)

```
warning ok.yml nodes[0].icon: Icon collection "Some set" is licensed under GPL-3.0 (https://…): check that its terms allow your use before publishing the site.
```

The collection's license may restrict publishing (see
[Licenses and redistribution](/config/icons#licenses-and-redistribution)). Check its terms, or
choose an icon from another collection.

## Usage errors (exit code 2)

```
✗ Missing the architecture file: graphinity validate <file>
  Run "graphinity --help" for usage.
```

```
✗ --port does not apply to "build".
  Run "graphinity --help" for usage.
```

`graphinity <command> --help` shows the arguments and options of a command.

## The starter files already exist

```
✗ architecture.yml, universes/example.yml already exist in the current directory. Nothing was written.
  Run "graphinity init --force" to overwrite, or choose another directory: graphinity init <dir>
```

[`init`](/cli/init) never overwrites files silently. Outside a terminal it does not ask and
writes nothing (exit code `1`); at a terminal it asks `Overwrite? (y/N)` first. Run it in another
directory (`graphinity init <dir>`), or add `--force` to replace the files. A folder in the way
of a file (or the reverse) cannot be overwritten, even with `--force`:

```
✗ "architecture.yml" is a directory: move it away first.
```

## The output directory is not empty

```
✗ /home/me/project/dist is not empty and was not created by graphinity. Remove it or choose another --out.
```

`build` never empties a directory it did not create. Choose another `--out`, or remove the
directory yourself.

## The viewer is not built

```
✗ The viewer is not built. Run "pnpm build" in the graphinity package.
```

Only when running the CLI from the sources of the repository: build the package once with
`pnpm build`.
