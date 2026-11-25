# Viewer

The viewer is a Vue 3 application built with [Vue Flow](https://vueflow.dev) and
[ELK](https://eclipse.dev/elk/). It ships **precompiled** inside the package: `dev` serves it,
`build` copies it.

## What it shows

- **One universe at a time**, on a dark canvas with a subtle grid - or on the universe's
  [background](/config/universe#background), a fixed wallpaper that does not pan or zoom.
- **Nodes** as square tiles of their size, with their logo, tags on the corners, name and
  description below. Nodes that open a universe are drawn doubled: a second tile
  behind their own, shifted down and to the right.
- **Groups** as labelled frames behind their nodes (groups inside groups nest), their name in the
  group's color, filled with a tint, a color or nothing, optionally blurring the background
  behind them.
- **Connections** with right angles, arrowheads and labels, in their configured color and style.
  Connections that share a side of a node attach at their own points, spread along that side of
  the tile. A connection to a group attaches to the group's frame.
- **Controls** at the bottom left: zoom in, zoom out, fit the universe to the screen, show or
  hide the grid.
- **A search field** at the top right, to find a node or a group in any universe
  (see [Search](#search)).

## Interactions

| Action | Effect |
| ------ | ------ |
| Click a node | Opens the details panel (top right, below the search field). |
| Type in the search field (`/` or `Ctrl K` / `⌘K` to reach it) | Lists the nodes and groups whose name matches; choosing one goes to it (see [Search](#search)). |
| Double-click a doubled node | Opens its universe. |
| *Open* in the details panel | Same as the double-click. |
| Click a connection in the details | Selects the node at the other end, or, when that end is a node of a parent universe, goes back there. A group at the other end is listed as `Name (group)`, without a link. An end inside a sub-universe (a path) is listed with the names along the path: `Integrations › Business services`; clicking it selects the node that holds it. |
| Breadcrumb (top left) | Goes back to any parent level. |
| Back button | Goes up one level (disabled at the root). |
| `Esc`, click on the canvas or a group | Closes the details panel. |
| Drag a node | Moves it; it cannot leave its group. |
| Drag a group | Moves the group with its nodes; the connections to its frame follow. |
| Drag the canvas, scroll | Pan, zoom. |
| Scroll on, at maximum zoom | An *Opening …* bar fills with the amount scrolled (about five notches of the wheel), while the diagram moves towards the node and fades; then the universe of the doubled node closest to the mouse cursor opens: the node under the cursor, otherwise the nearest one (the only one, wherever the cursor is, if there is just one). Moving the cursor to another node starts the bar over for it. |
| Scroll on, zoomed out a little beyond the whole universe | A *Back to …* bar fills (about five notches) while the diagram moves away; then the parent comes back. |
| Click a door (translucent node `↩ …`) | Goes back to the universe of that node. |
| Grid button (bottom left) | Shows or hides the grid of the universe, for the session. Not saved: the default comes from [`background.grid`](/config/universe#background). |

## Search

The search field (top right) finds the **nodes and groups of every universe** by their name.
Matching ignores case, accents and repeated spaces, and finds the text anywhere in the name; ids,
descriptions, tags and connection labels are not searched. Doors are not listed: the node they
stand for is, in its own universe.

- **Results** are listed in two sections: *This universe* (the one shown) first, then *Other
  universes*. In each, whole-name matches come first, then names that start with the text, then
  words that start with it, then the rest; then universes closer to the root, then names in
  alphabetical order. Each result says whether it is a node (a small tile with its icon) or a
  group (a dashed frame), the group it is in, and, for other universes, the universe's name. Two
  results with the same name in the same place also show their id. A universe opened by several
  nodes is listed once.
- **Choosing a result** (click, or `Enter`) goes to it: the view moves to the node or group and
  frames it, and a ring pulses around it, then stays until you choose something else or click the
  canvas. A node is also selected: its details panel opens. A result of another universe opens
  that universe first: through the path shown when the universe is on it or below it (the
  breadcrumb is kept), otherwise from the root, by the fewest levels.
- **Keyboard**: `/` or `Ctrl K` (`⌘K`) puts the cursor in the field; `↓` and `↑` move through the
  results, `Enter` goes to the highlighted one (the first by default); `Esc` clears the field, and
  in an empty field gives the keyboard back to the diagram. The `×` button clears the field too.
- **Many results**: the first 50 are shown, with how many there are in all; type more to narrow
  them. Nothing found: *No node or group matches "…"*.

The **details panel** lists the description, tags, sub-universe (with its number of nodes),
incoming and outgoing connections, and the node's id, group, icon and source file.

Moving nodes is a **view-only** convenience: nothing is saved, and nothing can be created,
deleted or connected. All the connections are then drawn again together, as in the first view:
around the other nodes, spread along the sides of the nodes, side by side where they share a
corridor. The computed layout comes back when the universe is reopened or a file changes.

## Navigation state

- The path of universes is kept in the URL hash: `#/platform/eu-west` (ids after the root). The
  browser's back and forward buttons, reloads and shared links all work; an invalid path opens
  its longest valid part.
- A universe opened by several nodes of the same universe keeps the node it was opened through:
  its doors and connections are those of that node, and the URL names the node after a `~` when
  it is not the first of them (`#/platform/eu-west/checkout~checkout-canary`). Back, the
  breadcrumb and the browser history return to the universe it was opened from.
- A universe is fitted to the screen on its first visit. Its zoom and position are remembered
  for the session, and restored when you come back to it the same way.
- With `dev`, the page reloads its data on every change and stays on the same universe.

## Layout

Each universe is laid out when it is opened, in the browser (ELK is loaded as a separate
script). Rules: [Automatic layout](/concepts/layout).

## Loading errors

- Configuration errors (with `dev`): the diagram is still shown, without the elements the errors
  concern, and a *N configuration errors* button at the bottom lists them. If the root file
  itself cannot be read, the errors are listed instead of the diagram. The page recovers by
  itself once the files are fixed.
- A node whose icon is invalid shows the generic icon.
- An empty universe shows *This universe is empty.*
- A local image or icon file that fails to load is replaced with the generic icon.

## Icons

Simple Icons logos are drawn from path data, in their brand color. Icons of the other collections
and local images are displayed through `<img>` elements, from files of the site: the viewer never
downloads anything from elsewhere. See [How icons reach the viewer](/config/icons#how-icons-reach-the-viewer).

## Browser support

Any recent version of Chrome, Edge, Firefox or Safari. The site must be served over HTTP (it
does not run from `file://`).
