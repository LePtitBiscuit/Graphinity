# Connections

A **connection** is an arrow from one node to another, listed in the `connections` of a universe.

```yaml [architecture.yml]
id: app
name: App
nodes:
  - id: web
    name: Web
    icon: react
  - id: api
    name: API
    icon: go
  - id: db
    name: Database
    icon: postgresql
connections:
  - from: web
    to: api
    label: HTTPS
  - from: api
    to: db
    label: SQL
```

- **`from`** and **`to`** are node ids of the **same universe** - or paths to nodes inside its
  sub-universes (see below).
- **`label`** is an optional text drawn on the connection.
- The arrowhead points to `to` by default; [`arrow`](/config/connection) can put it at the start,
  at both ends, or nowhere.
- [`color`](/config/colors-and-styles) and [`style`](/config/colors-and-styles#line-styles)
  (`solid`, `dashed`, `dotted`) change how it looks.

A connection may go from a node to itself, and several connections may link the same two nodes.

## Connections into sub-universes

An end can be a node **inside** the universe opened by one of the nodes, written as a path:
`checkout/api` is the node `api` of the universe opened by `checkout` (several levels:
`platform/eu-west/checkout/api`, up to 8). The universe draws the connection on `checkout`; the sub-universe draws it on `api`, from a
*door* standing for the other end. See
[Connections across universes](/concepts/sub-universes#connections-across-universes).

A connection always starts from the universe that declares it: it cannot reach a node of a parent
universe or of an unrelated one.

## How they are drawn

Connections are routed automatically, with right angles, and avoid the nodes; labels get their
own space. An end can choose the [side](/config/connection#ends-and-sides) of the node it attaches
to (`from: { node: api, side: right }`). They also define the **order of the nodes along the flow**: a node is placed after
the nodes that point to it. See [Automatic layout](/concepts/layout).
