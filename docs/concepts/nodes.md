# Nodes

A **node** is a thing in a universe: a service, a server, a product, a team, an external API…
It is drawn as a square **tile** with its logo, its **name** below, then its **description**.

```yaml [architecture.yml]
id: stack
name: Stack
nodes:
  - id: api
    name: API
    icon: nodedotjs
    description: REST API
  - id: db
    name: PostgreSQL
    icon: postgresql
    description: primary database
    tags: [v16]
```

```
             ┌──────┐  [v16]          ← tag (top-right corner)
             │ logo │
             └──────┘
            PostgreSQL                ← name
         primary database             ← description
```

## Required fields

- **`id`** - unique within the universe; connections refer to nodes by id.
- **`name`** - the text below the tile.
- **`icon`** - a named icon from one of the [icon collections](/config/icons#syntax)
  (`postgresql`, `logos:kubernetes`, `dashboard:jellyfin`…) or the path of a
  [local image](/config/icons#local-images).

## Optional fields

- **`description`** - a short text below the name (two lines at most on the tile, in full in the
  details panel).
- **`universe`** - the file this node opens: see [Sub-universes](/concepts/sub-universes).
- **`group`** - the [group](/concepts/groups-and-tags#groups) the node belongs to.
- **`tags`** - up to four short texts on the corners of the tile:
  [Tags](/concepts/groups-and-tags#tags).
- **`color`**, **`border`** - the border of the tile, and **`background`** - its fill:
  [Colors and styles](/config/colors-and-styles).
- **`size`** - `small`, `medium` (default) or `large`.
- **`place`** or **`after`** - a [placement hint](/config/node#placement-hints): `place: first`
  or `place: last` puts the node at the start or the end of the flow, `after: <node id>` further
  along the flow than another node of the universe. One hint per node.

All fields, with their types and limits: [Node reference](/config/node).

## In the viewer

- **Click** a node to open its details panel: description, tags, group, connections,
  sub-universe, id, icon and source file.
- A node that opens a universe is drawn **doubled** (a second tile behind its own);
  **double-click** it to open it.
- You can **drag** a node to rearrange the view (not saved).
