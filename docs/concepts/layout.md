# Automatic layout

Positions are never written in the files. Each universe is laid out automatically, with
[ELK](https://eclipse.dev/elk/), when the viewer opens it. A node can only give a
[placement hint](#placement-hints) along the flow.

## Direction

The `direction` of a universe sets where connections flow:

| `direction`        | Flow |
| ------------------ | ---- |
| `right` (default)  | left to right |
| `down`             | top to bottom |
| `left`             | right to left |
| `up`               | bottom to top |

Each universe has its own direction; sub-universes do not inherit it.

```yaml [architecture.yml]
id: services
name: Services
direction: down
nodes:
  - id: nginx
    name: Nginx
    icon: nginx
  - id: api
    name: API
    icon: nodedotjs
connections:
  - from: nginx
    to: api
```

## Order along the flow

- A node is placed **after the nodes that point to it**; nodes without incoming connections come
  first.
- When connections form a **loop** (`nginx → api` and `api → nginx`), only the connection that
  closes the loop is drawn against the flow, so nodes keep their place. A loop without any entry
  starts at the node listed first in the file.
- For an exchange in both directions, prefer one connection with `arrow: both`.
- Between otherwise equivalent placements, the **order of the file** decides: list nodes in the
  order you want to read them.

## Placement hints

The layout places nodes in **layers** along the flow: columns when the direction is `right` or
`left`, rows when it is `down` or `up`. A node can take one hint (see
[Node › Placement hints](/config/node#placement-hints)):

| Hint | Effect |
| ---- | ------ |
| `place: first` | The node goes in the first layer of the flow (the first column of a `right` universe). |
| `place: last` | The node goes in the last layer of the flow. |
| `after: <node id>` | The node goes further along the flow than that node of the same universe: an invisible connection from that node is added for the layout only (nothing is drawn). |

```yaml [architecture.yml]
id: pipeline
name: Pipeline
nodes:
  - id: ingest
    name: Ingest
    icon: apachekafka
  - id: transform
    name: Transform
    icon: logos:dbt-icon
  - id: notebooks
    name: Notebooks
    icon: jupyter
    after: transform   # to the right of Transform, not under it
  - id: archive
    name: Archive
    icon: logos:aws-s3
    place: last        # in the last column
connections:
  - from: ingest
    to: transform
  - from: ingest
    to: archive
```

Hints only choose the layer. Positions stay computed: there are no coordinates, the order inside
a layer still follows the file, and there is no hint to put a node in the same column or row as
another one.

## Connections

- Routed with right angles, with arrows and labels, avoiding nodes. The layout places the nodes;
  the connections are then drawn **all together**, the same way in the first view and after a
  drag: each takes the shortest simple route (a few turns at most) that crosses no node.
- They prefer the sides the universe flows through. For left/right flows, they attach to a side
  of the tile. For up/down flows, they enter the top of the tile and leave **below the text**,
  so they never cross a name. Another side is taken when it is clearly shorter - a connection
  back to a door above, for example.
- A connection can choose its sides instead: `from: { node: api, side: right }` (see
  [Ends and sides](/config/connection#ends-and-sides)). The other connections are laid out around it.
- A single connection on a side of a node attaches in its middle. When several connections use
  the same side, **each gets its own attachment point**, spread evenly along that side of the
  tile (across its height on the left and right, across its width at the top and bottom), in the
  order of the way they turn after leaving it - the one turning closest to the node takes the
  outer place - so that they do not cross.
- Each route avoids crossing the other connections, running along them, and running over the
  title of a group.
- Connections that would run along each other are drawn **side by side**, in parallel lanes 8 px
  apart. Two ends facing each other that are nearly aligned are joined by a straight line.
- In the first view, when the layout engine's own routes are less tangled (fewer crossings,
  overlaps and turns), they are kept for the whole universe.
- **Labels** go on their connection, where they cover no node, no group title and no other label
  when possible, crossing as few other lines as possible.
- Nodes take the room of their [size](/config/node) (`small`, `medium`, `large`).
- In a sub-universe, [doors](/concepts/sub-universes#connections-across-universes) to nodes of
  the parents are placed at the start of the flow (connections come from them) or at its end
  (connections go to them).

## Groups

Groups are laid out together with their nodes, with room for their title. A group inside another
group is laid out inside it. Connections cross group frames freely.

A connection to a group ([Connecting groups](/config/connection#connecting-groups)) attaches to
its frame: in the middle of a side, or spread along it when several connections share that side,
on the side set in the configuration if any. It never runs through the inside of the frame, and
the nodes inside the group do not get in its way. When a connection's `side` on a group cannot
be reached by a simple route (the other end is right behind the group), it follows the layout
engine's route, which may use another side.

## Nodes that open a universe

They are drawn **doubled**: a copy of their tile behind it, shifted 6 px down and to the right,
with the same [border and fill](/config/node). It stays inside the layout box of the node;
connections on its right side attach to the tile behind. Doors, in sub-universes, are drawn `large` and translucent, like
frosted glass.

## Moving nodes

You can drag nodes and groups in the viewer. The connections are then drawn again, all together,
as in the first view: around the other nodes, spread along the sides, side by side where they
share a corridor; the sides set in the configuration are kept. Nothing is saved: reopening the
universe, or changing a file, brings back the computed layout. See [Viewer](/reference/viewer).
