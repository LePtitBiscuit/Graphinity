# Node

An item of `nodes`.

| Property      | Type | Required | Default | Description |
| ------------- | ---- | -------- | ------- | ----------- |
| `id`          | id | **yes** | | Unique within the universe. Used by connections (`from`, `to`). |
| `name`        | text, ≤ 200 characters | **yes** | | Shown below the tile, on one line (cut with "…" when too long; in full in the details panel). |
| `icon`        | [icon](/config/icons) | **yes** | | The logo in the tile: a named icon (`github`, `logos:react`, `dashboard:jellyfin`…) or a relative path to an image. |
| `description` | text, ≤ 5000 characters | no | | Shown below the name, on two lines at most; in full in the details panel. |
| `universe`    | path, ≤ 500 characters | no | | `.yml`, `.yaml` or `.json` file of the universe this node opens. The node is then drawn doubled: a second tile behind its own. |
| `group`       | id | no | | Id of a [group](/config/group) declared in the same universe. |
| `tags`        | list of [tags](/config/tags), ≤ 4 | no | | Short texts on the corners of the tile. |
| `color`       | [color](/config/colors-and-styles#colors) | no | theme | Border color of the tile. |
| `border`      | `solid` · `dashed` · `dotted` · `none` | no | `solid` | Border style of the tile. |
| `background`  | [color](/config/colors-and-styles#colors) | no | theme | Fill color of the tile. Use `#rrggbbaa` for a translucent tint (`'#3fb95026'`). |
| `size`        | `small` · `medium` · `large` | no | `medium` | Size of the tile: 40, 56 or 80 px (icons of 22, 30 or 44 px). The box around it is 120, 144 or 176 px wide. |
| `place`       | `first` · `last` | no | | [Placement hint](#placement-hints): the node goes in the first or the last layer of the flow. |
| `after`       | id | no | | [Placement hint](#placement-hints): the node goes further along the flow than this node of the same universe. |
| `beside`      | id | no | | [Placement hint](#side-by-side): the node goes in the same layer as this node of the same universe and group (the same row when the flow goes down or up, the same column when it goes right or left). |

## Example

```yaml [architecture.yml]
id: payments
name: Payments
nodes:
  - id: stripe
    name: Stripe
    icon: stripe
    description: card payments
    tags: [€0.25 + 1.5%]
    color: purple
  - id: worker
    name: Webhooks worker
    icon: nodedotjs
    border: dashed
    universe: ./worker.yml
connections:
  - from: stripe
    to: worker
    label: webhooks
```

```yaml [worker.yml]
id: worker
name: Webhooks worker
nodes:
  - id: queue
    name: Queue
    icon: redis
```

## Placement hints

Positions are always [computed](/concepts/layout): there are no coordinates. Three optional hints
steer where a node goes along the flow of its universe (its [direction](/concepts/layout#direction)):

- **`place: first`** or **`place: last`** - the node goes in the first or the last layer of the
  flow: the first or last column when the direction is `right` or `left`, the first or last row
  when it is `down` or `up`. Several nodes can share that layer.
- **`after: <node id>`** - the node goes further along the flow than that node of the same
  universe, as if a connection went from it to this node. That connection is invisible: it is
  only used by the layout, nothing is drawn and it is not listed in the details panel.
- **`beside: <node id>`** - the node goes in the same layer as that node, next to it (see
  [Side by side](#side-by-side)).

A node takes **one** hint at most: `place`, `after` or `beside`. Inside a layer, nodes still
follow the order of the file.

`place` wins over the connections: a connection into a `first` node (or out of a `last` one) is
drawn against the flow. `after` cannot contradict them: `a` after `c` while connections lead from
`a` to `c` is an error, and the hint is left out.

```yaml [architecture.yml]
id: shop
name: Shop
nodes:
  - id: web
    name: Storefront
    icon: vuedotjs
  - id: api
    name: API
    icon: nodedotjs
  - id: db
    name: Database
    icon: postgresql
  - id: cdn
    name: CDN
    icon: cloudflare
    place: first      # in the first column, with the storefront
  - id: metrics
    name: Metrics
    icon: prometheus
    after: api        # further right than the API, although nothing connects them
connections:
  - from: web
    to: api
  - from: api
    to: db
```

## Side by side

`beside: <node id>` keeps a node in the **same layer** as another node of the universe: the same
row when the universe flows `down` or `up`, the same column when it flows `right` or `left`. The
other nodes still follow the connections, in any direction. A connection between two nodes of one
layer does not move them: it is drawn straight across, from one tile to the other. To keep the two
ends of a connection side by side, set [`align: true`](/config/connection#side-by-side) on the
connection instead.

```yaml [architecture.yml]
id: crm
name: CRM
direction: down
nodes:
  - id: web
    name: Website
    icon: vuedotjs
  - id: crm
    name: CRM
    icon: hubspot
  - id: billing
    name: Billing
    icon: stripe
    beside: crm       # in the row of the CRM, not below it
  - id: warehouse
    name: Data warehouse
    icon: snowflake
connections:
  - from: web
    to: crm
  - from: crm
    to: billing       # drawn across the row
    label: invoices
  - from: billing
    to: warehouse
```

- Both nodes must be in the same [group](/config/group), or both outside any group: each group
  lays out its own nodes.
- Several nodes can share a layer (`b` beside `a`, `c` beside `b`); the order inside the layer
  still follows the file and the connections.
- `place` wins: a node `beside` a `first` node is in the first layer too.

An invalid hint is an error and is left out (the node keeps its computed place):

| Hint | Message |
| ---- | ------- |
| `place: middle` | `"place" must be one of first, last, got "middle"` |
| `place` and `after` on the same node | `A node takes one placement hint: "place" is already set (use one of place, after, beside)` (`after` is left out; same with `beside`) |
| `after: nope`, no such node in the universe | `Unknown node "nope" (placement hints reference nodes of the same universe)` |
| `after: c` on the node `c` | `A node cannot be placed after itself ("c")` |
| `beside: c` on the node `c` | `A node cannot be placed beside itself ("c")` |
| `beside: a` on a node of another group | `"d" (in group "g") and "a" (outside any group) cannot be side by side: only nodes of the same group can be aligned` |
| `a` after `c`, `c` after `b`, `b` after `a` | `Placement hints form a loop (a → c → b → a)` - reported once, on the first node of the loop in the file, whose hint is left out |
| `a` after `c`, with connections `a → b → c` | `"a" cannot be placed after "c": the connections lead from it to "c" (a → b → c)` |

## Drawing

```
             ┌──────┐  [tag]
             │ logo │            ← tile (border: color, border)
             └──────┘
               Name
         description text
```

- A `medium` tile is a 56 px square with a 30 × 30 px logo; `small` and `large` tiles are 40 and
  80 px, with logos of 22 and 44 px.
- A node with a `universe` is drawn **doubled**: a copy of its tile behind it, shifted down and to
  the right, with the same border and fill. Connections on its right side attach to the tile
  behind.
- Clicking a node shows its details; double-clicking a doubled node opens its universe.
