# Limitations

What Graphinity does **not** do today. Each point is a current limit of the
implementation, not a hidden feature.

## Distribution

- **Not yet published on npm.** Install it from a package archive or run it from the repository:
  see [Installation](/guide/installation).
- Node.js **22.4 or later** is required (22.18 or later to develop Graphinity itself).

## CLI

- **One starter project.** [`init`](/cli/init) always creates the same three entries
  (`architecture.yml`, `universes/example.yml`, `assets/icons/`): there are no templates to
  choose from, and it asks no question besides confirming an overwrite.

## Configuration

- **Connections only reach down.** A connection is declared in a universe and starts from one of
  its nodes; an end can be a node inside one of its sub-universes
  ([path](/config/connection#connecting-to-a-sub-universe) `checkout/api`, up to 8 levels), never a
  node of a parent or of an unrelated universe.
- **Groups nest up to 4 levels**, and a node (or a group) belongs to one group at most.
- **Groups as connection ends.** A connection can link groups of the universe that declares it,
  or end on a [group of a sub-universe](/config/connection#a-group-of-a-sub-universe)
  (`checkout/workers`), but a path cannot go through a group. A group cannot be connected to
  itself nor to what is inside it.
- **No choice of the point along a side.** A connection can choose the
  [side](/config/connection#ends-and-sides) of a node, not a position along it: the connections
  that share a side are spread along it automatically.
- **No manual positions.** Positions are always computed; the files cannot store coordinates.
  The only hints are [`place`](/config/node#placement-hints) (`first` or `last` layer of the
  flow), [`after`](/config/node#placement-hints) (further along the flow than another node) and
  [`beside`](/config/node#side-by-side) (in the same layer as another node), and
  [`align`](/config/connection#side-by-side) on a connection. Nodes of different groups cannot
  share a layer (each group lays out its own nodes).
- **Icons**: [Iconify collections](/config/icons#any-iconify-collection), Dashboard Icons and
  local images - no remote image URLs, and only plain Iconify icons and aliases (no rotated or
  flipped variants).
- **Downloaded icons need the network** the first time each icon is used (Iconify collections
  that are not bundled, Dashboard Icons). Cached icons are never refreshed: delete the cache to
  get updated versions. Dashboard Icons are pinned to one version of the collection: icons added
  to it later are not available until the package updates the pinned commit.
- **One YAML document per file**, and files of at most 1 MB.
- No includes, variables or templates: each file is plain data.

## Viewer

- **Some connections against the flow go around.** A connection that closes a loop is drawn by a
  direct route when one crosses no node and runs along no other connection; otherwise it is
  routed around the nodes in between (`side` only applies where the node itself is drawn, not on
  the node or door standing for it). Use `arrow: both` for an exchange in both directions.
- **No editing.** The viewer is read-only: nothing can be created, deleted, connected or saved.
- **Dragged positions are not kept**: reopening a universe or changing a file brings back the
  computed layout.
- Connection routes have a few turns at most: when none of them avoids every node, the layout's
  own route is kept (or, after a drag, the shortest route even if it crosses a node). For a
  connection to a group, that route may attach to another side of the frame than the configured
  `side`. Many
  connections between the same areas are drawn side by side, which takes room. Routes avoid
  crossings and group titles as far as their few shapes allow: after a drag, some crossings,
  or a line over a title, can remain. When no free place is left, a label may cover another
  one.
- **A file opened by several nodes of the same universe is reached through the first of them.**
  The navigation path stores universe ids only, so the breadcrumb step, the doors and the
  connections drawn into that universe always follow the first node (in file order) that opens
  it, whichever was double-clicked. A shared file works as expected when it is opened from
  different parent universes (as `checkout.yml`, opened from both clusters of the example).
- **Dark theme only.**
- **One universe at a time**: there is no overview of several levels at once.
- The layout engine (ELK) is a large script (about 450 kB compressed), loaded with the page.

## Static site

- Must be served over **HTTP**: it does not run from `file://`.
- Rebuild it to reflect changes: a built site does not watch files.
