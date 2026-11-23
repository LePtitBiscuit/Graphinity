# Connection

An item of `connections`: an arrow between two nodes of the same universe, or to (or from) a node
inside one of its [sub-universes](#connecting-to-a-sub-universe).

| Property | Type | Required | Default | Description |
| -------- | ---- | -------- | ------- | ----------- |
| `from`   | node id or [path](#connecting-to-a-sub-universe), or [end](#ends-and-sides) | **yes** | | Source node, in the same universe (or inside one of its sub-universes). |
| `to`     | node id or [path](#connecting-to-a-sub-universe), or [end](#ends-and-sides) | **yes** | | Target node, in the same universe (may be `from` itself), or inside one of its sub-universes. |
| `label`  | text, ≤ 200 characters | no | | Text drawn on the connection. |
| `color`  | [color](/config/colors-and-styles#colors) | no | theme | Color of the line and of its arrowheads. |
| `style`  | `solid` · `dashed` · `dotted` | no | `solid` | Line pattern. |
| `arrow`  | `end` · `start` · `both` · `none` | no | `end` | Which ends carry an arrowhead: `end` points to `to`, `start` points to `from`. |

## Example

```yaml [architecture.yml]
id: services
name: Services
nodes:
  - id: web
    name: Web
    icon: react
  - id: api
    name: API
    icon: nodedotjs
  - id: cache
    name: Cache
    icon: redis
  - id: monitor
    name: Monitoring
    icon: grafana
connections:
  - from: web
    to: api
    label: HTTPS
    color: blue
  - from: api
    to: cache
    style: dashed
    arrow: both
  - from: monitor
    to: api
    style: dotted
    color: gray
    arrow: none
```

## Ends and sides

By default a connection leaves its source and enters its target on the sides the universe flows
through (see [`direction`](/concepts/layout#direction)). To choose a side, write the end as a
mapping:

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `node`   | node id | **yes** | The node. |
| `side`   | `left` · `right` · `top` · `bottom` | no | Side of the node where the connection attaches. Default: the side of the flow. |

```yaml [architecture.yml]
id: payments
name: Payments
direction: down
nodes:
  - id: stripe
    name: Stripe
    icon: stripe
  - id: worker
    name: Webhooks worker
    icon: nodedotjs
  - id: db
    name: Database
    icon: postgresql
connections:
  - from: { node: stripe, side: left }
    to: { node: worker, side: top }
  - from: worker                   # default side
    to:
      node: db
      side: right
```

- Left and right ends attach to the side of the tile; the top end to the top of the tile; the
  bottom end below the name and description (connections never cross the text). A single
  connection on a side attaches in its middle; several connections on the same side are spread
  evenly along the tile, each at its own point (see [Automatic layout](/concepts/layout#connections)).
- A side may go against the flow (`side: top` on the source of a `down` universe): the
  connection turns around the node.
- The sides are kept when nodes are [moved](/concepts/layout#moving-nodes).
- An invalid `side` is an error; the connection is drawn on the default side.

## Connecting to a sub-universe

An end can be a node **inside** the universe of a node of this universe: write its path,
`node/inner` (`checkout/api`: the node `api` of the universe opened by `checkout`), on several
levels if needed (`platform/eu-west/checkout/api`, up to 8).

```yaml
connections:
  - from: storefront
    to: checkout/api                  # drawn on checkout here; on api inside the checkout universe
  - from: { node: checkout/saga, side: right }
    to: routing/api                   # from one sub-universe to another
```

This universe draws the connection on the node that contains the end (`checkout`); the sub-universe
draws it on the end itself, with a door for the other end. See
[Connections across universes](/concepts/sub-universes#connections-across-universes).

- The first node must open a universe (`Node "stripe" does not open a universe ("stripe/x")`), and each
  following id must be a node of the universe reached
  (`Unknown node "apii" in universe "checkout" ("checkout/apii")`). Otherwise the connection is not
  drawn.
- A connection from a node to the inside of its own universe (`checkout → checkout/api`) is only drawn
  inside.

## Rules

- `from` and `to` must be ids of nodes of **the same universe** (for a path, its first id); an
  unknown id is an error
  (`Unknown node "api" (connections must reference nodes of the same universe)`).
- An end, path included, is at most 100 characters long.
- Several connections may link the same two nodes; a connection may link a node to itself.
- Connections also order the nodes along the flow: see [Automatic layout](/concepts/layout).
