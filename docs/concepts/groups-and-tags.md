# Groups and tags

## Groups

A **group** draws a labelled frame around some nodes of a universe - a cloud provider, a server,
a network. Declare the groups of the universe in `groups`, then set `group` on their nodes.

```yaml [architecture.yml]
id: web
name: Web
groups:
  - id: vercel
    name: Vercel
    icon: vercel
nodes:
  - id: next
    name: Next.js
    icon: nextdotjs
    description: chat ui
    group: vercel
  - id: hono
    name: Hono
    icon: hono
    description: api routes
    group: vercel
  - id: db
    name: Neon
    icon: postgresql
connections:
  - from: next
    to: hono
    label: RPC
  - from: hono
    to: db
    label: SQL
```

- A node belongs to **one group at most**; a group can be inside another group with its own
  `group` property, up to 4 levels ([Groups inside groups](/config/group#groups-inside-groups)).
- A group needs **at least one node** (an empty group is reported as an error - usually a typo
  in a node's `group`).
- Connections go in and out of groups freely. A group can also be an **end** of a connection
  itself - from a node, to a node or to another group: the arrow attaches to its frame
  ([Connecting groups](/config/connection#connecting-groups)).
- A group can have an `icon`, a `color`, a `border` style, a `background` (or none) and a
  `blur`: [Group reference](/config/group).
- In the viewer, dragging a group moves its nodes (and the groups inside it) along; a node stays
  inside its group.

## Tags

**Tags** are short texts on the corners of a node's tile: a price, a version, an environment, a
status… A node has **at most four**, one per corner.

```yaml [architecture.yml]
id: data
name: Data
nodes:
  - id: db
    name: PostgreSQL
    icon: postgresql
    tags:
      - €24/mo                                # top-right
      - v16                                   # top-left
      - { text: primary, corner: bottom-left }
```

Tags without a `corner` take the free corners in this order: `top-right`, `top-left`,
`bottom-right`, `bottom-left`. See the [Tags reference](/config/tags).
