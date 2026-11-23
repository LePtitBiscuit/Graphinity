# File structure

## A project

A **project** is a directory that contains the root file and every file it references, directly
or not. Here is the layout of the Kestrel Logistics example (`examples/kestrel` in the
repository): 16 universes over five levels.

```
kestrel/                        ← project directory (the root file's directory)
├── architecture.yml            ← root universe: Kestrel Logistics
├── edge/
│   └── edge.yml                ← universe of the "Edge network" node
├── platform/
│   ├── platform.yml            ← universe of the "Kestrel Platform" node: two regions
│   ├── observability.yml
│   ├── clusters/
│   │   ├── eu-west.yml         ← the primary Kubernetes cluster
│   │   └── us-east.yml         ← the standby cluster
│   └── services/
│       ├── checkout.yml        ← opened from both clusters
│       ├── catalog.yml
│       └── routing.yml
├── data/
│   ├── data.yml
│   ├── kafka.json              ← a JSON universe
│   └── orders-db.yml           ← opened from platform/services/checkout.yml
├── warehouses/
│   ├── warehouses.yml
│   ├── lyon.yml
│   └── rotterdam.yml
├── delivery/
│   └── delivery.yml
└── images/
    └── floor-plan.svg          ← background image of the Lyon hub
```

Folders are only a convention: any layout works, as long as every file stays inside the project
directory. [`graphinity init`](/cli/init) starts a small project with the same idea: the root
universe `architecture.yml`, sub-universes in `universes/` and your own logos in `assets/icons/`.

## How files are linked

Files are linked by **paths relative to the file that contains them**:

- the **`universe`** field of a node points to another universe file;
- the **`icon`** field of a node or a group may point to an image;
- the **`background.image`** field of a universe points to an image.

```
architecture.yml
  nodes[platform].universe: ./platform/platform.yml    ──► platform/platform.yml
platform/platform.yml
  nodes[eu-west].universe:  ./clusters/eu-west.yml     ──► platform/clusters/eu-west.yml
platform/clusters/eu-west.yml
  nodes[checkout].universe: ../services/checkout.yml   ──► platform/services/checkout.yml
platform/services/checkout.yml
  nodes[db].universe:       ../../data/orders-db.yml   ──► data/orders-db.yml
warehouses/lyon.yml
  background.image:         ../images/floor-plan.svg   ──► images/floor-plan.svg
```

## Anatomy of a file

The top level of every file is a universe; the order of the fields does not matter.

```yaml [architecture.yml]
id: platform              # unique in the project
name: Platform            # shown in the breadcrumb
direction: down           # optional: right (default), down, left, up
groups:                   # optional frames
  - id: cloud
    name: Cloud
nodes:                    # required (may be empty: nodes: [])
  - id: api
    name: API
    icon: nodedotjs
    group: cloud
  - id: db
    name: Database
    icon: postgresql
    group: cloud
connections:                    # optional connections
  - from: api
    to: db
```

## YAML or JSON

Files are YAML (`.yml`, `.yaml`) or JSON (`.json`); both can be mixed in one project. These two
files describe the same universe:

::: code-group

```yaml [architecture.yml]
id: shop
name: Shop
nodes:
  - { id: web, name: Web, icon: react }
  - { id: api, name: API, icon: go }
connections:
  - { from: web, to: api }
```

```json [shop.json]
{
  "id": "shop",
  "name": "Shop",
  "nodes": [
    { "id": "web", "name": "Web", "icon": "react" },
    { "id": "api", "name": "API", "icon": "go" }
  ],
  "connections": [{ "from": "web", "to": "api" }]
}
```

:::

::: tip Data only
A file contains data only: one YAML document per file, no YAML tags (`!!js/function`…), no
duplicate keys. See [Validation and limits](/config/validation).
:::
