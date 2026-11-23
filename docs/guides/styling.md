# Group, tag and style

## Frame related nodes

Declare `groups`, then put nodes in them with `group`:

```yaml [architecture.yml]
id: app
name: App
groups:
  - id: vercel
    name: Vercel
    icon: vercel
  - id: data
    name: Data
    color: blue
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
    name: PostgreSQL
    icon: postgresql
    group: data
  - id: cache
    name: Redis
    icon: redis
    group: data
connections:
  - from: next
    to: hono
    label: RPC
  - from: hono
    to: db
    label: SQL
  - from: hono
    to: cache
    style: dashed
```

## Annotate nodes with tags

Up to four tags per node, one per corner - prices, versions, environments:

```yaml [architecture.yml]
id: costs
name: Costs
nodes:
  - id: vps
    name: VPS
    icon: hetzner
    tags: [€24/mo, { text: prod, corner: bottom-left }]
  - id: db
    name: Managed database
    icon: supabase
    tags: [€25/mo, beta]
```

## Color and border

```yaml [architecture.yml]
id: status
name: Status
nodes:
  - id: new
    name: New service
    icon: go
    color: green
  - id: legacy
    name: Legacy
    icon: php
    color: "#f0883e"
    border: dashed
  - id: planned
    name: Planned
    icon: rust
    border: dotted
connections:
  - from: legacy
    to: new
    label: migration
    style: dashed
    color: orange
```

Reference: [Group](/config/group), [Tags](/config/tags),
[Colors and styles](/config/colors-and-styles).
