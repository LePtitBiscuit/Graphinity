# Connection

An item of `connections`: an arrow between two nodes or [groups](#connecting-groups) of the same
universe, or to (or from) a node inside one of its [sub-universes](#connecting-to-a-sub-universe).

| Property | Type | Required | Default | Description |
| -------- | ---- | -------- | ------- | ----------- |
| `from`   | node or group id, [path](#connecting-to-a-sub-universe), or [end](#ends-and-sides) | **yes** | | Source node or group, in the same universe (or a node inside one of its sub-universes). |
| `to`     | node or group id, [path](#connecting-to-a-sub-universe), or [end](#ends-and-sides) | **yes** | | Target node or group, in the same universe (a node may be `from` itself), or a node inside one of its sub-universes. |
| `label`  | text, ≤ 200 characters | no | | Text drawn on the connection. |
| `color`  | [color](/config/colors-and-styles#colors) | no | theme | Color of the line and of its arrowheads. |
| `style`  | `solid` · `dashed` · `dotted` | no | `solid` | Line pattern. |
| `arrow`  | `end` · `start` · `both` · `none` | no | `end` | Which ends carry an arrowhead: `end` points to `to`, `start` points to `from`. |
| `align`  | `true` · `false` | no | `false` | Keeps the two nodes [side by side](#side-by-side), in the same layer, and draws the connection straight across. |

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
| `node`   | node id or [path](#connecting-to-a-sub-universe) | `node` or `group` | The node. |
| `group`  | group id or [path](#a-group-of-a-sub-universe) | `node` or `group` | The [group](#connecting-groups) (instead of a node), or a group of a sub-universe (`integrations/business`). |
| `side`   | `left` · `right` · `top` · `bottom` | no | Side of the node or group where the connection attaches. Default: the side of the flow. |

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

## Connecting groups

An end can be a [group](/config/group) of the universe: the connection attaches to the frame of
the group. This links a node to a group, a group to a node, or a group to another group.

```yaml [architecture.yml]
id: hosting
name: Hosting
groups:
  - id: cloudflare
    name: Cloudflare
    icon: cloudflare
  - id: onprem
    name: On premises
nodes:
  - id: visitors
    name: Visitors
    icon: googlechrome
  - id: cdn
    name: CDN
    icon: cloudflare
    group: cloudflare
  - id: db
    name: Database
    icon: postgresql
    group: onprem
  - id: logs
    name: Logs
    icon: grafana
connections:
  - from: visitors
    to: cloudflare                 # node → group
  - from: cloudflare
    to: onprem                     # group → group
    label: tunnel
  - from: { group: cloudflare, side: bottom }
    to: logs                       # group → node, from the bottom of the frame
```

- A plain id names the **node** with that id, or the **group** when no node has it. Write
  `{ group: <id> }` to name the group whatever the nodes are called (a node and a group may share
  an id).
- The connection attaches to the border of the frame: in the middle of the side, or spread along
  it when several connections share that side. `side` chooses the side, as for a node.
- A group cannot be connected to itself
  (`A group cannot be connected to itself ("cloudflare")`), nor to a node or a group inside it
  (`Group "cloudflare" holds node "cdn": a connection cannot link a group to what is inside it`).
- A path cannot go through a group (`Group "cloudflare" does not open a universe ("cloudflare/cdn")`),
  but it can end on one: see [A group of a sub-universe](#a-group-of-a-sub-universe). The other end
  of a connection to a group may be a path: in the sub-universe, the group appears as a
  [door](/concepts/sub-universes#connections-across-universes), with its name and icon.
- A connection to a group that is not shown (a group without nodes, or without a valid name) is
  not drawn either; the group's own error is reported.

## Side by side

A connection orders its nodes: `to` goes one layer further along the flow than `from` (see
[Automatic layout](/concepts/layout#order-along-the-flow)), whatever its arrowheads. With
`align: true`, it does not: its two nodes stay **side by side** in one layer - the same row when
the universe flows `down` or `up`, the same column when it flows `right` or `left` - and the
connection is drawn straight across, from one tile to the other. The other connections still
order the flow, in any direction.

```yaml [architecture.yml]
id: group
name: Group
direction: down                  # stacked top to bottom
nodes:
  - id: holding
    name: Holding
    icon: mdi:domain
  - id: shop
    name: Shop
    icon: shopify
  - id: crm
    name: CRM
    icon: hubspot
  - id: payments
    name: Payments
    icon: stripe
connections:
  - from: holding
    to: shop                     # below the holding
  - from: shop
    to: crm                      # beside the shop, on the same row
    label: customers
    align: true
  - from: crm
    to: payments                 # below the CRM
```

- Both ends must be nodes of this universe, in the same [group](/config/group) or both outside
  any group (each group lays out its own nodes): not groups, not paths into sub-universes, not
  the same node. Otherwise the connection is drawn without `align`, and the error says why.
- Any connection between two nodes of one layer is drawn across, `align` or not: the same goes for
  nodes placed [`beside`](/config/node#side-by-side) each other.
- `side` still applies; without it, the connection takes the sides that face each other.

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
  following id must be a node of the universe reached; the last one may also be a group
  (`Unknown node or group "apii" in universe "checkout" ("checkout/apii")`). Otherwise the
  connection is not drawn.
- A connection from a node to the inside of its own universe (`checkout → checkout/api`) is only drawn
  inside.

### A group of a sub-universe

The last id of a path can name a **group** of the universe it reaches: a node of this universe is
then connected to a whole group of a lower level, in one connection, rather than one connection per
node of the group. Like a plain id, it names the node with that id, or the group when no node has
it; write `{ group: <path> }` to name the group whatever the nodes are called.

```yaml [architecture.yml]
id: company
name: Company
nodes:
  - id: agn360
    name: AGN360
    icon: mdi:car
  - id: integrations
    name: Business integrations
    icon: mdi:puzzle
    universe: ./integrations.yml
connections:
  - from: agn360
    to: integrations/business        # the group "business" of integrations.yml
    label: orders
  - from: { group: integrations/business, side: bottom }
    to: agn360
    label: status
```

```yaml [integrations.yml]
id: integrations
name: Business integrations
groups:
  - id: business
    name: Business services
nodes:
  - id: crm
    name: CRM
    icon: hubspot
    group: business
  - id: erp
    name: ERP
    icon: sap
    group: business
  - id: mail
    name: Mail
    icon: gmail
```

- Here, the connection is drawn on the node that opens the universe (`integrations`), as for a
  node path. Inside `integrations.yml`, it attaches to the frame of the group, with a door for
  AGN360. On the levels in between, it goes to the node that leads to the group.
- `side` applies to the frame of the group, inside the sub-universe.
- The group must be shown there (a group without nodes is not):
  `Unknown node or group "nope" in universe "integrations" ("integrations/nope")`; with
  `{ group }`: `Unknown group "nope" …`, with `{ node }`: `Unknown node "business" …`.

## Rules

- `from` and `to` must be ids of nodes or groups of **the same universe** (for a path, its first
  id must be a node); an unknown id is an error
  (`Unknown node or group "api" (connections must reference nodes or groups of the same universe)`;
  with `{ node }`: `Unknown node "api" …`, with `{ group }`: `Unknown group "api" …`).
- An end names a node or a group, not both
  (`An end names a node or a group, not both ("node" and "group" are set)`).
- An end, path included, is at most 100 characters long.
- Several connections may link the same two nodes or groups; a connection may link a node to
  itself (not a group).
- Connections also order the nodes along the flow: see [Automatic layout](/concepts/layout).
