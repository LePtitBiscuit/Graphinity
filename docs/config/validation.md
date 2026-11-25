# Validation and limits

`validate`, `dev` and `build` load the whole project and check everything before anything is
drawn. **All** problems are reported at once, each with its file, line, column and field:

```
✗ 2 errors
  architecture.yml:35:12 nodes[1].group: Unknown group "partners" (declare it in "groups")
  platform/clusters/eu-west.yml:55:15 nodes[2].universe: File not found: "../services/catalgo.yml"
```

The format is `file:line:column field: message`. Paths are relative to the directory you run the
command from.

## When there are errors

Errors only leave out **the element they concern**; everything else is still shown. This is
what the [`dev`](/cli/dev) server displays while you fix your files - with the list of errors
over the diagram:

| Error in… | What is not shown |
| --------- | ----------------- |
| a node's `icon` (malformed reference, missing or unsafe file…) | the icon - the node shows the generic icon |
| a node's `description`, a tag, `color`, `border`, `background` or `size` | that element (default border, fill and size) |
| a node's `universe` (missing file, syntax error, circular reference…) | the link - the node does not open a universe |
| a node's `group` (unknown group) | its membership - the node is shown outside any frame |
| a node's `place`, `after` or `beside` (unknown value or node, the node itself, a loop, another group, several set) | that hint - the node keeps its computed place (with several set, the first of `place`, `after`, `beside` is kept) |
| a connection's `align` (not a boolean; a group, a path, the same node or another group at an end) | `align` - the connection is drawn, and orders its nodes as usual |
| a node's `id` or `name` | the node, and its connections |
| a connection (`from`, `to`, `color`, `style`, `arrow`) | the connection |
| a connection's path into a sub-universe (`checkout/apii`, or that universe is broken) | the connection |
| a connection to a group: unknown, itself, a node or group inside it, a path through it | the connection |
| a connection to a group that is not shown (no nodes, no valid name) | the connection (the group's error is reported, not the connection) |
| a connection's `label` | the label |
| a connection end's `side` | nothing: the default side is used |
| a group (`name` missing, no nodes) | the frame - its nodes are shown without it |
| a group's `icon`, `color`, `border`, `blur` or `background` | that element |
| a group's `group` (unknown, itself, a cycle, more than 4 levels) | the nesting - the group is shown at the top level |
| a universe's `background` (`image`, `color`, `blur`, `grid`) | that part - an invalid image is not shown, the color and blur still apply |
| a universe's `direction` | nothing: the default direction is used |
| a universe's `id` or `name` | nothing: an id is derived from the file name (`platform/clusters/eu-west.yml` → `platform-clusters-eu-west`) |
| a sub-universe file (syntax error, duplicate id…) | that universe - nodes do not open it |
| the root file (unreadable, syntax error, not a universe) | everything: only the errors are shown |

Unknown properties are reported and ignored.

[`validate`](/cli/validate) and [`build`](/cli/build) stay strict: any error makes them fail (exit
code `1`), and `build` writes nothing - an invalid configuration is never published.

## What is checked

**Syntax**

- Valid YAML or JSON.
- One document per file (no `---` separating several documents).
- No duplicate keys.
- No YAML tags (`!!js/function`, `!custom`…): files contain data only.

**Properties**

- Required properties are present; unknown properties are errors.
- Values have the right type (texts are strings; only tags accept numbers) and are not blank.
- Fixed values are among the allowed ones: `direction`, `border`, `style`, `arrow`, `size`,
  `place`, connection `side`, tag `corner`.
- `blur` is a number of pixels from 0 to 40.
- The universe's connections are under `connections` (`"edges" was renamed to "connections"`).
- Colors are hexadecimal or [palette names](/config/colors-and-styles#colors).
- Lengths are within the [limits](#limits).

**Identifiers and references**

- Ids are valid; universe ids are unique in the project; node and group ids are unique in their
  universe.
- Connections reference nodes or groups of the same universe, or - with a path (`checkout/api`) -
  nodes of the universes they open, up to 8 levels down. A group end is not linked to itself nor
  to a node or group inside it, and a path does not go through a group
  ([Connecting groups](/config/connection#connecting-groups)).
- `group` references a group declared in the universe; every group has at least one node,
  directly or in a group inside it; groups nest as a tree of at most 4 levels.
- At most 4 tags per node, one per corner.
- [Placement hints](/config/node#placement-hints): at most one per node (`place`, `after` or
  `beside`); `after` names another node of the same universe, and hints do not form a loop
  (`a` after `b`, `b` after `a`); `beside` names another node of the same universe and group.
- A connection with [`align`](/config/connection#side-by-side) links two nodes of the universe, in
  the same group: not a group, a path into a sub-universe or the node itself.

**Files**

- Named icons are well-formed: `name` or `prefix:name` (see [Icons](/config/icons#syntax)), at
  most 120 characters.
- Local SVG icons are [safe SVG documents](/config/icons#svg-validation).
- Referenced files (`universe`, local `icon`, background `image`) exist, have a supported extension, and stay inside
  the project directory - symbolic links included. Absolute paths and URLs are refused.
- No circular references between universes.

**Warnings** (the configuration stays valid)

- Named icons not found in their collection, collections that do not exist, icons that could
  not be downloaded: the generic icon is shown. See [Icons](/config/icons#syntax).
- Icon collections whose license may restrict publishing (GPL, share-alike, non-commercial): check
  their terms. See [Licenses and redistribution](/config/icons#licenses-and-redistribution).

## Limits

| What | Limit |
| ---- | ----- |
| Size of a configuration file | 1 MB |
| Id | 100 characters |
| Name, connection label | 200 characters |
| Path (`universe`, `icon`, background `image`) | 500 characters |
| Named icon (`mdi:database`) | 120 characters |
| Local SVG file | 512 KB |
| Connection end (`from`, `to`, path included) | 100 characters, 8 levels |
| `blur` | 0 to 40 px |
| Description | 5000 characters |
| Tag | 40 characters, 4 per node |
| Groups inside groups | 4 levels |
| YAML alias expansion | limited (protects against "billion laughs" documents) |
| Nesting depth of universes | none |

See [Common errors](/cli/errors) for the messages you are most likely to meet.
