<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/svg/graphinity-horizontal-light-text.svg">
    <img src="brand/svg/graphinity-horizontal-dark-text.svg" alt="Graphinity" width="420">
  </picture>
</p>

# graphinity

[![CI](https://github.com/LePtitBiscuit/Graphinity/actions/workflows/ci.yml/badge.svg)](https://github.com/LePtitBiscuit/Graphinity/actions/workflows/ci.yml)
[![Documentation](https://github.com/LePtitBiscuit/Graphinity/actions/workflows/docs.yml/badge.svg)](https://leptitbiscuit.github.io/Graphinity/)
[![License: MPL 2.0](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](LICENSE)
[![Node.js >= 22.4](https://img.shields.io/badge/node-%3E%3D22.4-brightgreen.svg)](package.json)

**[Documentation](https://leptitbiscuit.github.io/Graphinity/)** ·
[Live demo](https://leptitbiscuit.github.io/Graphinity/guide/demo) ·
[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

Interactive, **recursive** architecture diagrams from plain YAML or JSON files.

Describe each level of your system in its own file - an organisation, a platform, a server, its
services - and link them: any node can open the level inside it. `graphinity` validates
the whole hierarchy, lays every level out automatically and serves it as a clean interactive
diagram, or builds it into a static site.

- **Files are the only source of truth.** No editor, no database, no coordinates to maintain.
- **Recursive universes**, without depth limit: double-click a node to open the universe inside it.
- **Automatic layout** (ELK), with orthogonal connections, arrows and labels.
- **Any Iconify icon** - generic icons and logos from the 200+ [Iconify](https://icon-sets.iconify.design)
  collections (`mdi:database`, `lucide:network`, `logos:aws`…) -, Dashboard Icons, or your own
  images. Bundled into the generated site: it works offline.
- **Groups and tags** to frame nodes and annotate them (prices, versions…).
- **Styling**: colors and border styles for nodes and groups; color, line style and arrowheads for connections.
- **Live reload** while you edit, with precise errors (file, line, field).
- **Static build** deployable on any static host, without backend.

## Contents

1. [Installation](#installation)
2. [Quick start](#quick-start)
3. [Principle](#principle)
4. [Organising the files](#organising-the-files)
5. [Configuration reference](#configuration-reference)
6. [Validation rules](#validation-rules)
7. [Layout](#layout)
8. [Using the viewer](#using-the-viewer)
9. [Commands](#commands)
10. [Deployment](#deployment)
11. [Security](#security)
12. [Programmatic API](#programmatic-api)
13. [Development](#development)

## Installation

Requires Node.js 22.4 or later (tested on the LTS lines 22, 24 and 26).

```sh
npm install --save-dev graphinity
# or run it without installing - the fastest start, a starter project:
npx graphinity init
npx graphinity dev architecture.yml
```

The package ships a precompiled viewer: there is nothing else to install (no Vue, no Vite).
`npx graphinity --help` lists the commands; `npx graphinity` alone prints a welcome page.

## Quick start

The fastest start is a starter project:

```sh
npx graphinity init                     # or: npx graphinity init my-architecture
npx graphinity dev architecture.yml
```

`init` creates, in the current directory (or the one given, created if missing):

```
.
├── architecture.yml        ← root universe "My system": web, api, database
├── universes/
│   └── example.yml         ← universe "API" (server, queue, worker), opened by the "api" node
└── assets/
    └── icons/              ← empty: your own SVG logos (icon: ./assets/icons/<name>.svg)
```

It uses only logos bundled with the package (it works offline), and never overwrites a file
without asking (see [`init`](#init-dir)). Then:

1. Edit `architecture.yml` to define your nodes.
2. Run `npx graphinity dev architecture.yml`: the browser opens on the diagram, and every save
   updates it.
3. Read the [documentation](https://leptitbiscuit.github.io/Graphinity/).

To write the files by hand instead, create two files:

```yaml
# architecture.yml - the root universe
id: platform
name: My platform
nodes:
  - id: web
    name: Web app
    icon: vuedotjs
  - id: api
    name: API
    icon: nodedotjs
    description: REST API and background jobs.
    universe: ./api.yml # double-click this node to open api.yml
connections:
  - from: web
    to: api
    label: HTTPS
```

```yaml
# api.yml - the universe inside the "API" node
id: api
name: API
nodes:
  - id: server
    name: Server
    icon: nodedotjs
  - id: db
    name: PostgreSQL
    icon: postgresql
connections:
  - from: server
    to: db
    label: SQL
```

Then run:

```sh
npx graphinity dev architecture.yml
```

The browser opens on the diagram. Edit and save a file: the page updates.

## Principle

**One file = one universe = one diagram.** A universe is a level of your architecture: the
nodes it contains (services, servers, products, teams…) and the connections between them.

**Nodes can open universes.** A node with a `universe` field points to another file, which is a
complete universe of its own - and its nodes can point to further files, without depth limit.
This is how you zoom from an organisation down to the services of a server, one level at a time.

**One root file.** You give the commands one file, the *root universe*. Everything reachable
from it, through `universe` fields, is loaded, validated and shown; files that are not
referenced are ignored.

**Read, validate, lay out, display.** Each command reads the root file and every referenced
file, checks them all (fields, identifiers, connections, paths, cycles), and reports every error
at once. The viewer then lays out each universe automatically when you open it, and shows
**one universe at a time**.

**The files stay the source of truth.** The viewer never writes anything: you can move nodes on
screen to look at them, but the layout is always recomputed from the files.

## Organising the files

### A project

A project is a directory that contains the root file and every file it references, directly or
not. A typical layout, from the bundled example
[`examples/kestrel`](examples/kestrel) (*Kestrel Logistics*, a fictional fulfilment and delivery
group, over 16 universes and five levels):

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

| File                             | Role |
| -------------------------------- | ---- |
| `architecture.yml`               | Root universe *Kestrel Logistics*, left to right on a custom dark background: the people (customers, merchants, couriers, in a dotted blue group), Kestrel's own systems in an orange group (each opens a level-2 universe; the large *Kestrel Platform* node has a tint and corner tags) and third-party services (Stripe, Sentry, PagerDuty, Slack) in a dashed group without background. Its connections reach deep into the sub-universes by path (`edge/cdn`, `platform/eu-west/checkout/api`, `data/kafka/orders`, `warehouses/lyon/wms`). |
| `edge/edge.yml`                  | *Edge network*: DNS, CDN, WAF, API gateway and two load balancers, in groups nested inside a *Cloudflare* group. A leaf. |
| `platform/platform.yml`          | *Kestrel Platform*, top to bottom: the two regions (`eu-west`, `us-east`) and the shared services (observability, Vault, registry, object storage). A connection comes from two levels down (`eu-west/checkout/db/primary`). |
| `platform/clusters/eu-west.yml`  | *eu-west-1 cluster*, over the grid: groups nested on the maximum of 4 levels (cluster › applications › commerce namespace › checkout node pool); its nodes `catalog`, `checkout` and `routing` open the service files. |
| `platform/clusters/us-east.yml`  | *us-east-1 cluster*, with a tinted grid: a smaller copy whose `checkout` node opens the same `checkout.yml` as eu-west. |
| `platform/observability.yml`     | *Observability*: the Grafana stack and alerting, with icons downloaded from the Iconify API (`mdi:bell-ring`, `mdi:book-open-variant`). A leaf. |
| `platform/services/checkout.yml` | *Checkout service*, top to bottom - the universe shared by both clusters. Its `db` node opens `../../data/orders-db.yml`, in another folder. |
| `platform/services/catalog.yml`  | *Catalog service*: API, search, indexer, image resizer, database, stock. The image resizer is placed at the end of the flow (`place: last`). A leaf, without groups. |
| `platform/services/routing.yml`  | *Routing service*, drawn right to left: planning and live tracking. A leaf. |
| `data/data.yml`                  | *Data platform*, on its own background color and grid: streaming, lakehouse and analytics; its `kafka` node opens `kafka.json`, and its `notebooks` node comes after the dbt models (`after: dbt`). |
| `data/kafka.json`                | *Kafka cluster*, written in JSON, top to bottom: brokers, topics, schema registry. A leaf. |
| `data/orders-db.yml`             | *Orders database*, level 5, bottom to top: PgBouncer, a Patroni cluster with nested replicas, etcd and backups. A leaf. |
| `warehouses/warehouses.yml`      | *Warehouse network*: Lyon opens `lyon.yml`, Rotterdam opens `rotterdam.yml`, Newark opens nothing yet (tag *opens 2027*); a connection links two sub-universes (`rotterdam/restock` → `lyon/wms`). |
| `warehouses/lyon.yml`            | *Lyon hub*, bottom to top over a floor plan (`background.image`, blurred), with frosted groups and warehouse-floor icons from the Iconify API (`mdi:barcode-scan`, `mdi:printer`, …). A leaf. |
| `warehouses/rotterdam.yml`       | *Rotterdam returns centre*, top to bottom: intake, then the outcomes of grading. A leaf. |
| `delivery/delivery.yml`          | *Software delivery*: GitHub, CI, Argo CD, Terraform, with icons of the bundled collections (`devicon:docker`, `vscode-icons:file-type-terraform`). A leaf. |
| `images/*`                       | The background image of the Lyon hub, referenced by a relative path from `lyon.yml`. |

Every icon of the example is a named icon: bundled logos (Simple Icons, `logos:`, `devicon:`,
`vscode-icons:`) and icons of other Iconify collections (`mdi:warehouse`,
`fluent-emoji-flat:eagle`, …), downloaded from the Iconify API the first time the diagram is
built, then cached.

The folders are only a convention: any layout works, as long as every file stays inside the
project directory. `graphinity init` starts a small project with the same convention:
the root universe `architecture.yml`, sub-universes in `universes/`, your own logos in
`assets/icons/` (see [Quick start](#quick-start)).

### How files are linked

A file is linked to another by the **`universe` field of a node**, and to an image by the
**`icon` field** (of a node or a group) or the **`background.image` field** of a universe. Both are **paths relative to the file that contains
them**:

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

- **Paths are relative** to the file they are written in. Absolute paths and URLs are refused.
- **Everything stays in the project directory** - by default the root file's directory, or the
  directory given with `--project`. A path (or a symbolic link) leading outside is an error.
- **A universe can be shared**: several nodes, in the same or different files, may open the same
  file. It is loaded once; this is not a cycle.
- **No cycles**: a file cannot lead back to one of the files that lead to it
  (`a.yml → b.yml → a.yml`). The error shows the whole chain.
- **Identifiers**: each universe `id` is unique in the whole project (it appears in the viewer's
  URL). Node and group ids only need to be unique within their universe.
- **Connections reach down**: a connection links two nodes of the same universe, or reaches a
  node inside the sub-universe of one of them by its path (`checkout/api`, see
  [Connection](#connection)). It cannot reach a node of a parent or unrelated universe: add a
  node for it there.

### File formats

Each file is YAML (`.yml`, `.yaml`) or JSON (`.json`); both can be mixed in one project. The two
examples below describe the same universe:

```yaml
id: shop
name: Shop
nodes:
  - { id: web, name: Web, icon: react }
  - { id: api, name: API, icon: go, universe: ./api.json }
connections:
  - { from: web, to: api }
```

```json
{
  "id": "shop",
  "name": "Shop",
  "nodes": [
    { "id": "web", "name": "Web", "icon": "react" },
    { "id": "api", "name": "API", "icon": "go", "universe": "./api.json" }
  ],
  "connections": [{ "from": "web", "to": "api" }]
}
```

Files contain data only: no code, no YAML tags (`!!js/function`…), one document per file.

## Configuration reference

An empty value (`null`, or a field left out) means "not set". Text fields must not be blank.
Unknown fields are errors, so typos are caught.

### Universe

The top level of every file.

| Field       | Type     | Required | Default | Description |
| ----------- | -------- | -------- | ------- | ----------- |
| `id`        | id       | yes      |         | Unique in the whole project. Shown in the viewer's URL. |
| `name`      | text     | yes      |         | Shown in the breadcrumb. Max 200 characters. |
| `direction` | `right`, `down`, `left` or `up` | no | `right` | Where the connections flow: `right` = left to right, `down` = top to bottom. See [Layout](#layout). |
| `background` | mapping: `image`, `color`, `blur`, `grid` | no | | A fixed wallpaper behind the diagram (see below). |
| `groups`    | list of [groups](#group) | no | `[]` | Frames around some nodes. |
| `nodes`     | list of [nodes](#node) | yes |  | The nodes of the universe. May be empty (`nodes: []`). |
| `connections` | list of [connections](#connection) | no | `[]` | Connections between nodes of this universe. |

An **id** is made of letters, digits, `.`, `_` and `-`, starts with a letter or a digit, and is at
most 100 characters long (`api`, `lyon-hub`, `db.primary`).

The list of connections was called `edges` before: a file that still uses `edges` gets the error
`"edges" was renamed to "connections"`.

`background` puts an image and/or a color behind the diagram. It covers the screen and does not
move when you pan or zoom:

| Field   | Type | Description |
| ------- | ---- | ----------- |
| `image` | path | Local image (`.svg`, `.png`, `.webp`, `.jpg`, `.jpeg`), relative to the file, inside the project - same rules as local icons. |
| `color` | [color](#colors) | Color behind the diagram. |
| `blur`  | number, 0–40 | Blur of the image, in px. |
| `grid`  | `true`, `false` or a [color](#colors) | Grid on the canvas, in that color if one is given (`'#ffffff22'`). Default: shown, unless there is an `image`. |

```yaml
id: office
name: Office
background:
  image: ./images/office.jpg
  blur: 8
groups:
  - id: lan
    name: LAN
    blur: 12          # frosted glass over the wallpaper
```

### Node

| Field         | Type   | Required | Description |
| ------------- | ------ | -------- | ----------- |
| `id`          | id     | yes      | Unique within the universe. Used by connections (`from`, `to`). |
| `name`        | text   | yes      | Shown below the tile (one line, cut with "…" if too long). Max 200 characters. |
| `icon`        | [icon](#icons) | yes | The logo in the tile. |
| `description` | text   | no       | Shown below the name (2 lines at most) and in full in the details panel. Max 5000 characters. |
| `universe`    | path   | no       | Relative path to the file of the universe this node opens. The node is then drawn doubled: a second tile behind its own. |
| `group`       | id     | no       | Id of a [group](#group) declared in this universe. |
| `tags`        | list of [tags](#tags) | no | Up to 4 short texts on the corners of the tile. |
| `color`       | [color](#colors) | no | Border color of the tile. |
| `border`      | `solid`, `dashed`, `dotted` or `none` | no | Border style of the tile. Default `solid`. |
| `background`  | [color](#colors) | no | Fill color of the tile (`'#3fb95026'` for a translucent tint). |
| `size`        | `small`, `medium` or `large` | no | Tile of 40, 56 or 80 px. Default `medium`. |
| `place`       | `first` or `last` | no | Placement hint: the node goes in the first or the last layer of the flow (column for `right`/`left`, row for `down`/`up`). |
| `after`       | id     | no       | Placement hint: the node goes further along the flow than this node of the same universe (nothing is drawn between them). |

A node takes at most one placement hint, `place` or `after`; positions are still computed (no
coordinates, and the order inside a layer follows the file):

```yaml
id: shop
name: Shop
nodes:
  - id: web
    name: Storefront
    icon: vuedotjs
  - id: api
    name: API
    icon: nodedotjs
  - id: cdn
    name: CDN
    icon: cloudflare
    place: first      # in the first column
  - id: metrics
    name: Metrics
    icon: prometheus
    after: api        # further along the flow than the API, although nothing connects them
connections:
  - from: web
    to: api
```

A node is drawn as a square tile with its icon, its tags on the corners, its name below and its
description below the name:

```
      [v16]  ┌──────┐  [€24/mo]       ← tags (top-left, top-right)
             │ icon │
      [beta] └──────┘                 ← tag (bottom-left)
            PostgreSQL                ← name
         primary database             ← description
```

### Tags

Tags annotate a node: a price, a version, an environment, a status… Each one sits on a corner of
the tile, so a node has **at most 4**.

A tag is either a **text or a number** (at most 40 characters), placed on the first free corner,
or a **mapping** `{ text, corner }` that chooses its corner:

| Field    | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `text`   | text or number | yes | The text shown. Max 40 characters (longer texts are cut on screen, shown in full on hover and in the details panel). |
| `corner` | `top-right`, `top-left`, `bottom-right` or `bottom-left` | no | Where to show it. |

Tags without a corner fill the free corners in this order: **`top-right`, `top-left`,
`bottom-right`, `bottom-left`**. Two tags cannot use the same corner.

```yaml
  - id: db
    name: PostgreSQL
    icon: postgresql
    tags:
      - €24/mo                                # top-right
      - v16                                   # top-left
      - { text: primary, corner: bottom-left }
```

### Group

A group draws a labelled frame around some nodes of a universe - a cloud provider, a server, a
network. Declare the groups in `groups`, then set `group` on the nodes that belong to them.

| Field  | Type   | Required | Description |
| ------ | ------ | -------- | ----------- |
| `id`   | id     | yes      | Unique within the universe. Used by the nodes' `group` field. |
| `name` | text   | yes      | Shown at the top of the frame. Max 200 characters. |
| `icon` | [icon](#icons) | no | Shown before the name. |
| `color` | [color](#colors) | no | Color of the frame: its border, its name, and a light tint of its background. |
| `border` | `solid`, `dashed`, `dotted` or `none` | no | Border style of the frame. Default `solid`. |
| `blur` | number, 0–40 | no | Blurs what is behind the frame (the universe background), in px. |
| `group` | id | no | The group this group is inside of: groups nest, up to 4 levels. |
| `background` | [color](#colors) or `none` | no | Fill of the frame; `none` draws only its border and name. Default: a light tint of `color`. |

- A node belongs to one group at most; a group can be inside another group (4 levels at most,
  no cycles).
- A group without any node, directly or in a group inside it, is an error (most likely a typo in
  a node's `group`).
- Connections go in and out of groups freely.

```yaml
groups:
  - id: vercel
    name: Vercel
    icon: vercel
    color: blue
    border: dashed
nodes:
  - id: next
    name: Next.js
    icon: nextdotjs
    description: frontend
    group: vercel
  - id: hono
    name: Hono
    icon: hono
    description: api routes
    group: vercel
connections:
  - from: next
    to: hono
    label: RPC
```

Groups inside groups - a cloud, a region in it, a network in the region:

```yaml
groups:
  - id: azure
    name: Microsoft Azure
    icon: logos:microsoft-azure
    color: blue
    background: none          # border and name only
  - id: region
    name: Region Japan East
    group: azure              # inside "azure"
    background: "#1a1d24"
  - id: vnet
    name: Virtual network
    group: region
nodes:
  - id: app
    name: App Service
    icon: devicon:azure
    group: region
  - id: sql
    name: SQL Database
    icon: devicon:azuresqldatabase
    group: vnet
connections:
  - from: app
    to: sql
    label: SQL
```

### Connection

An arrow from one node to another, in the same universe (or inside one of its sub-universes).

| Field   | Type | Required | Description |
| ------- | ---- | -------- | ----------- |
| `from`  | id or path, or `{ node, side }` | yes | The source node; `side` chooses where the connection leaves it. |
| `to`    | id or path, or `{ node, side }` | yes | The target node (may be `from` itself); `side` chooses where it enters. |
| `label` | text | no       | Shown on the connection. Max 200 characters. |
| `color` | [color](#colors) | no | Color of the line and its arrowheads. |
| `style` | `solid`, `dashed` or `dotted` | no | Line pattern. Default `solid`. |
| `arrow` | `end`, `start`, `both` or `none` | no | Which ends carry an arrowhead: `end` points to `to` (default), `start` to `from`. |

Several connections may link the same two nodes.

An end can also be a node **inside a sub-universe**, by its path: `checkout/api` is the node
`api` of the universe opened by `checkout` (several levels: `platform/eu-west/checkout/api`, up
to 8). The universe draws the connection on `checkout`; the checkout universe draws it on `api`,
from a **door** standing for the other end. In every sub-universe, the parent nodes connected to the node that opens it appear as
doors - large, translucent nodes marked `↩ <universe>`, at the start of the flow for those
connections come from, at the end for the others - and clicking one goes back to its universe.

```yaml
# platform/clusters/eu-west.yml
connections:
  - from: storefront
    to: checkout/api         # "storefront → checkout" here; a "storefront" door → api inside checkout
  - from: checkout/saga
    to: routing/api          # from one sub-universe to another
```

By default, a connection leaves and enters nodes on the sides the universe flows through
(`direction`). `side` - `left`, `right`, `top` or `bottom` - chooses another one, even against
the flow; it is kept when nodes are dragged. An invalid side falls back to the default.

```yaml
connections:
  - from: { node: stripe, side: left }
    to: { node: worker, side: top }
  - from: worker          # default sides
    to: stripe
```

```yaml
connections:
  - from: web
    to: api
    label: HTTPS
    color: blue
  - from: api
    to: cache
    style: dashed       # e.g. an optional or asynchronous link
    arrow: both
  - from: monitor
    to: api
    style: dotted
    color: gray
    arrow: none
```

### Colors

A `color` is either a hexadecimal color - `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` (`#4f8cff`,
`#f80`) - or one of these names, chosen to read well on the dark background:

| Name     | Color     | Name     | Color     |
| -------- | --------- | -------- | --------- |
| `gray`   | `#8a93a5` | `yellow` | `#d29922` |
| `white`  | `#e6e9ef` | `orange` | `#f0883e` |
| `blue`   | `#4f8cff` | `red`    | `#f85149` |
| `teal`   | `#2fb8ac` | `pink`   | `#db61a2` |
| `green`  | `#3fb950` | `purple` | `#a371f7` |

Names are case-insensitive. Any other value (CSS functions, `rgb()`, other names) is an error.

### Icons

The `icon` of a node or a group is a named icon of a collection, or a local image:

| `icon` value | Collection | License | Source |
| ------------ | ---------- | ------- | ------ |
| `mdi:database`, `lucide:network`, `tabler:server`, `fa6-brands:docker`… | **any [Iconify collection](https://icon-sets.iconify.design)** - `prefix:name` | per collection | downloaded at build time from the Iconify API, cached |
| `github`, `simple-icons:github` | [Simple Icons](https://simpleicons.org) - brand logos, in brand color | CC0-1.0 | bundled (`simple-icons`) |
| `devicon:react` | [Devicon](https://github.com/devicons/devicon) - languages and tools | MIT | bundled (`@iconify-json/devicon`) |
| `logos:kubernetes` | [SVG Logos](https://github.com/gilbarbara/logos) - color logos | CC0-1.0 | bundled (`@iconify-json/logos`) |
| `vscode-icons:file-type-docker` | [VSCode Icons](https://github.com/vscode-icons/vscode-icons) - file types | MIT | bundled (`@iconify-json/vscode-icons`) |
| `dashboard:jellyfin` | [Dashboard Icons](https://github.com/homarr-labs/dashboard-icons) - self-hosted apps | Apache-2.0 | downloaded at build time, pinned and cached |
| `./icons/billing.svg` | local image: `.svg`, `.png`, `.webp`, `.jpg`, `.jpeg` | yours | your project |

```yaml
nodes:
  - { id: db, name: Database, icon: mdi:database }        # generic icon (Material Design Icons)
  - { id: net, name: Network, icon: lucide:network }      # generic icon (Lucide)
  - { id: k8s, name: Cluster, icon: logos:kubernetes }    # logo (bundled)
  - { id: cdn, name: CDN, icon: simple-icons:cloudflare } # logo (bundled)
```

- Prefixes and names are case-insensitive: lowercase letters and digits separated by single
  hyphens, as on [icon-sets.iconify.design](https://icon-sets.iconify.design). A malformed
  reference is an error; an icon or a collection that does not exist, or a failed download,
  shows a generic icon, with a warning.
- Iconify collections other than the four bundled ones are downloaded from the **official
  Iconify API** (`api.iconify.design`, and its official mirrors `api.simplesvg.com` and
  `api.unisvg.com`) when a diagram is built: only the icons referenced, grouped by collection
  (up to 32 per request), at most 4 requests at a time, 10 s timeout. The data is validated and kept in
  `~/.cache/graphinity/iconify/`; once cached, no request is made.
  `GRAPHINITY_OFFLINE=1` forbids all downloads (cache only). In `dev`, icons added to a
  file are downloaded when it is saved.
- Icons are resolved when the diagram is built: a site contains only the icons it uses (SVG files
  in `icons/`, one per distinct icon, plus `icons/ATTRIBUTIONS.md` and the license texts
  redistribution requires) and works offline.
- Dashboard Icons has no npm package: its icons are downloaded from the collection's repository
  (through jsDelivr, pinned to one commit), validated and cached in
  `~/.cache/graphinity/dashboard-icons/` the first time they are used.
- These downloads are the only network accesses of Graphinity, at build time only; they
  reveal the names of the icons used to the Iconify API and jsDelivr. Generated sites never
  download anything.
- Every SVG (local, bundled or downloaded) is validated: no scripts, event handlers or external
  references.
- Prefer SVG images; for other formats use a square image of at least 96×96 px. Images are
  displayed at 30×30 px in `medium` nodes (22×22 and 44×44 px in `small` and `large` ones) and
  16×16 px in groups.

Full details: the documentation site, *Configuration › Icons*.

### Limits

| What                          | Limit       |
| ----------------------------- | ----------- |
| Size of a configuration file  | 1 MB        |
| Id                            | 100 characters |
| Name, connection label        | 200 characters |
| Path (`universe`, `icon`, background `image`) | 500 characters |
| Named icon (`mdi:database`)   | 120 characters |
| Local SVG file                | 512 KB      |
| Connection end (`from`, `to`, path included) | 100 characters, 8 levels |
| `blur`                        | 0 to 40 px  |
| Description                   | 5000 characters |
| Tag                           | 40 characters, 4 per node |
| Groups inside groups          | 4 levels    |
| Nesting depth of universes    | none        |

## Validation rules

`validate`, `dev` and `build` check the whole project and report **every** error with its file,
line, column and field:

```
$ graphinity validate architecture.yml
✗ 2 errors
  architecture.yml:35:12 nodes[1].group: Unknown group "partners" (declare it in "groups")
  platform/clusters/eu-west.yml:55:15 nodes[2].universe: File not found: "../services/catalgo.yml"
```

What is checked:

- **Syntax**: valid YAML or JSON, one document, no duplicate keys, no YAML tags (`!!…`).
- **Fields**: required fields present, known fields only, right types, lengths within limits.
- **Identifiers**: valid ids; universe ids unique in the project; node and group ids unique in
  their universe.
- **References**: connections point to nodes of the same universe (or, by path, of the
  universes they open); `group` points to a declared
  group; every group has at least one node (directly or in a group inside it); groups nest as a
  tree of at most 4 levels (no group inside itself, no cycle); at most 4 tags, one per corner;
  a node has at most one placement hint (`place` or `after`), `after` names another node of the
  same universe and hints form no loop (`Placement hints form a loop (a → c → b → a)`); `after`
  must not contradict the connections (`"a" cannot be placed after "c": the connections lead
  from it to "c" (a → b → c)`). `place` wins over the connections, which are then drawn against
  the flow.
- **Values**: `direction`, `border`, `style`, `arrow`, `size`, `place`, connection `side` and tag
  corners are among their allowed values; colors are hexadecimal or palette names; `blur` is
  0–40 px; connections are under `connections` (not `edges`).
- **Files**: referenced files exist, have a supported extension and stay inside the project
  directory; no circular references between universes.
- **Icons**: references are well-formed (`name` or `prefix:name`); local SVG files are safe SVG
  documents.

Warnings (the configuration is still valid): icons or collections not found, icons that could
not be downloaded, and collections whose license may restrict publishing (GPL, share-alike,
non-commercial).

Each error only leaves out the element it concerns: the `dev` server still shows everything else
(an invalid icon → the generic icon; an invalid connection → not drawn; an invalid description,
tag, color, border, background, size or blur → left out; an invalid placement hint (`place`,
`after`) → left out, the node keeps its computed place; a wrong group `group` → that group at
the top level; an invalid `side` → the default side; an invalid background
image → not shown; an invalid `universe` → no link; a node without a valid id or name → not
shown). `validate` and `build` stay strict: any error fails them, and `build` writes nothing.

## Layout

Positions are never written in the files: each universe is laid out automatically when it is
opened, with these rules.

- **Direction.** Connections flow in the universe's `direction`: left to right by default, top to
  bottom with `down` (also `left`, `up`). Each universe has its own direction.
- **Order along the flow.** A node is placed after the nodes that point to it; nodes without
  incoming connections come first. When connections form a loop (`nginx → api` and
  `api → nginx`), only the connection that closes the loop is drawn against the flow, so nodes
  keep their place; a loop without any entry starts at the node listed first in the file.
  For an exchange in both directions, prefer one connection with `arrow: both`.
- **File order** decides between otherwise equivalent placements: list nodes in the order you
  want to read them.
- **Placement hints.** Nodes are placed in layers along the flow (columns for `right`/`left`,
  rows for `down`/`up`). `place: first` or `place: last` puts a node in the first or last layer;
  `after: <node id>` puts it further along the flow than that node, through an invisible
  connection used by the layout only. One hint per node; there are no coordinates and no hint to
  put a node in the same column or row as another.
- **Connections** are orthogonal, with arrows and labels, and avoid nodes. The layout places the
  nodes; the connections are then drawn **all together**, the same way in the first view and
  after a drag: each takes the shortest simple route (at most a few turns) that crosses no node,
  preferring the sides the universe flows through - for horizontal flows the sides of the tile,
  for vertical flows the top of the tile and **below the text**, so they never cross a name -
  but taking another side when it is clearly shorter (a connection back to a door, for
  example). A connection that sets its own `side` keeps it. Each route avoids crossing the other
  connections and running along them or over a group's title. A single connection on a side
  attaches in its middle; connections sharing a side each get their own point, spread evenly
  along the tile and ordered by the way they turn after leaving it (the one turning closest to
  the node on the outside), so that they do not cross. Connections that would run along each
  other are drawn **side by side** in parallel lanes (8 px apart), and nearly aligned ends facing
  each other are joined by a straight line. In the first view, when the layout engine's own
  routes are less tangled (fewer crossings, overlaps, turns), they are kept. **Labels** go on
  their connection where they cover no node, no group title and no other label when possible,
  crossing as few other lines as possible.
- **Sizes.** Nodes take the room of their `size`: boxes of 120, 144 or 176 px wide.
- **Groups** are laid out with their nodes inside, with room for their title; a group inside a
  group is laid out inside it, as many levels deep as configured.
- **Nodes that open a universe** are drawn **doubled**: a copy of their tile behind it, shifted
  6 px down and to the right, with the same border. Connections on their right side attach to
  the tile behind.
- **Doors** (in a sub-universe, the nodes of the universes above it) are drawn `large`, as
  translucent frosted glass with a dashed outline.

## Using the viewer

One universe is shown at a time.

| Action                         | Effect |
| ------------------------------ | ------ |
| Click a node                   | Details panel: description, tags, group, connections, sub-universe, id, icon, source file. `Esc` or a click on the canvas closes it. |
| Double-click a doubled node | Opens its universe (also *Open* in the details panel). |
| Breadcrumb                     | Goes back to any parent level. |
| Back button (top left)         | Goes up one level. |
| Drag a node or a group         | Moves it. A group moves with its nodes; a node stays inside its group. All the connections are then drawn again together, as in the first view: around the other nodes, spread along the sides, side by side where they share a corridor (sides set in the files are kept). Not saved: the computed layout comes back when the universe is reopened or a file changes. |
| Drag the canvas, scroll        | Pans, zooms. The bottom-left buttons zoom and fit the universe to the screen. |
| Grid button (bottom left)      | Shows or hides the grid of the universe for the session (not saved; the default comes from `background.grid`). |
| Keep scrolling up at maximum zoom | An *Opening …* bar fills with the amount scrolled (about five notches of the wheel) while the diagram moves towards the node; then its universe opens. It is the doubled node closest to the mouse cursor (the one under it, if any; the only one, wherever the cursor is, when a single node opens a universe); moving the cursor to another node starts over for that one. Stopping cancels it. |
| Keep zooming out, a little beyond the whole universe | A *Back to …* bar fills (about five notches) while the diagram moves away; then the parent comes back. |
| Click a door (translucent node `↩ …`) | Goes back to the universe of that node. |

The path is kept in the URL (`#/platform/eu-west`): browser history, reloads and shared links
open the same level. Each universe is fitted to the screen on its first visit, and keeps its zoom
and position when you come back to it.

## Commands

```
graphinity <command> [options]
```

`graphinity --help` prints the general help:

```
Graphinity 0.1.0 - Interactive nested architecture diagrams

Usage: graphinity <command> [options]

Commands:
  init [dir]        Create a starter project (architecture.yml, universes/, assets/icons/)
  dev <file>        Serve the diagram on 127.0.0.1 and reload it when files change
  validate <file>   Check the configuration and every reference
  build <file>      Generate a static site, deployable on any static host

Options:
  -h, --help        Show this help, or a command's: graphinity <command> --help
  -v, --version     Show the version

Examples:
  graphinity init
  graphinity dev architecture.yml
  graphinity validate architecture.yml
  graphinity build architecture.yml --out site

Exit codes: 0 success, 1 invalid configuration or failure, 2 usage error.

Documentation: https://leptitbiscuit.github.io/Graphinity/
```

`graphinity <command> --help` (or `-h`) prints the help of one command: usage, arguments,
options, examples, exit codes and the link to its documentation page. `graphinity --version`
prints the version.

`graphinity` alone prints a welcome page: at a terminal, the Graphinity logo (drawn in Braille
characters, in the logo's violet-to-pink gradient) next to the name, the tagline and the version;
then the commands, how to get started and the documentation link. Outside a terminal, the logo is
left out:

```
  G R A P H I N I T Y
  Interactive nested architecture diagrams

  Version: 0.1.0

  Commands:
    init       Initialize a new Graphinity project
    dev        Start the interactive diagram viewer
    validate   Validate architecture configuration
    build      Generate a static website

  Get started:
    npx graphinity init
    npx graphinity dev architecture.yml

  Options and examples: graphinity --help

  Documentation:
    https://leptitbiscuit.github.io/Graphinity/
```

Colors and the logo are only shown at a terminal. `NO_COLOR` disables colors (the logo is then
drawn in plain characters), `TERM=dumb` too; `FORCE_COLOR` styles output that is not a terminal,
such as CI logs, and shows the logo. `validate` and `build` stay compact (no logo); `dev` prints
`Graphinity <version>  <url>` once the server is ready.

### `init [dir]`

Creates a starter project in `dir` (default: the current directory; created with its parents if
missing): `architecture.yml`, `universes/example.yml` and an empty `assets/icons/` folder (see
[Quick start](#quick-start)). Only icons bundled with the package are used: it works offline.

| Option    | Description |
| --------- | ----------- |
| `--force` | Overwrite existing files without asking. |

Existing files are never overwritten silently. At a terminal, `init` asks
`Overwrite? (y/N)`; anything but `y` writes nothing. Outside a terminal (CI, pipes), it refuses
with exit code `1` and writes nothing, unless `--force` is given:

```
✗ architecture.yml, universes/example.yml already exist in the current directory. Nothing was written.
  Run "graphinity init --force" to overwrite, or choose another directory: graphinity init <dir>
```

A folder where a file goes (or a file where a folder goes) is an error, even with `--force`.
Files are written next to their target, then moved into place: if writing fails, nothing is left
half-written. On success, it lists what it created (and what it overwrote) and the next steps:

```
$ graphinity init
✓ Graphinity project initialized successfully!

Created:
  architecture.yml
  universes/example.yml
  assets/icons/

Next steps:

  1. Edit architecture.yml to define your nodes.
  2. Run: npx graphinity dev architecture.yml
  3. Read the documentation:
     https://leptitbiscuit.github.io/Graphinity/
```

### `dev <file>`

Starts a local server on `127.0.0.1`, opens the browser and watches the root file, every
referenced universe and icon. Each change reloads the diagram, keeping your position in the
hierarchy. A broken file never stops the server: the errors are shown in the terminal, and the
page keeps showing the diagram without the elements they concern (an invalid icon shows the
generic icon, an invalid connection is not drawn…), with a button listing the errors. Only an
unreadable root file replaces the diagram with the errors.

| Option            | Default          | Description |
| ----------------- | ---------------- | ----------- |
| `-p, --port <n>`  | `4321`           | Port. Without the option, the next free port is used if 4321 is taken. |
| `--no-open`       |                  | Do not open the browser. |
| `--project <dir>` | file's directory | Directory that all referenced files must stay in. |

To show the diagram to someone else while you edit it, open a Cloudflare quick tunnel to it: the
server also answers requests for `<name>.trycloudflare.com` (and only those, besides
`127.0.0.1` and `localhost`).

```sh
graphinity dev architecture.yml --port 4321 --no-open
cloudflared tunnel --url http://127.0.0.1:4321
```

### `validate <file>`

Checks the whole project (see [Validation rules](#validation-rules)) without starting anything.
Useful in CI.

| Option            | Default          | Description |
| ----------------- | ---------------- | ----------- |
| `--project <dir>` | file's directory | Directory that all referenced files must stay in. |

### `build <file>`

Generates a standalone static site: the viewer, the resolved data of every universe and the
local icons.

| Option            | Default          | Description |
| ----------------- | ---------------- | ----------- |
| `-o, --out <dir>` | `dist`           | Output directory. |
| `--project <dir>` | file's directory | Directory that all referenced files must stay in. |

The output directory is replaced on every build, but only if a previous build created it: a
non-empty directory created by someone else is never emptied, and an output directory that would
contain the project or the working directory is refused.

### Exit codes

`0` success · `1` invalid configuration or failure (including `init` refusing to overwrite
existing files) · `2` usage error (unknown command or option).

## Deployment

`build` writes:

```
dist/
├── index.html          the viewer
├── favicon.svg         its icon (the Graphinity logo)
├── assets/             its scripts and styles
├── architecture.json   every universe, validated and resolved, with the logos used
├── files/              the local images, under their project-relative paths
└── icons/              icons of the collections used, ATTRIBUTIONS.md and licenses/
```

Keep `icons/ATTRIBUTIONS.md` and `icons/licenses/` when you publish the site.

Deploy the directory on any static host (GitHub Pages, Netlify, S3, nginx…); it works from any
sub-path. It must be served over HTTP (`npx serve dist` works): browsers do not run it from
`file://`.

## Security

Configuration files are treated as untrusted data:

- Data only: no code execution, YAML tags (`!!js/function`…) are rejected, alias expansion is
  limited, files are limited to 1 MB.
- Every referenced file must resolve inside the project directory (symbolic links included);
  absolute paths and URLs are refused.
- The viewer never injects markup: Simple Icons logos are drawn from path data, other icons and
  local images are displayed through `<img>` (SVG scripts never run), and every SVG is validated.
  The page has a strict Content Security Policy and loads nothing from a CDN.
- The only downloads happen at build time, from explicitly allowed hosts only: icon data from
  the official Iconify API (JSON, validated field by field) and Dashboard Icons (SVG, pinned to
  one commit). Every SVG is validated, everything is cached, requests are limited, time out and
  never follow redirects. No code is downloaded.
- The dev server listens on `127.0.0.1` only, answers only requests addressed to it (or through
  a Cloudflare quick tunnel, `*.trycloudflare.com`), and only serves the viewer and the files referenced by the architecture.

## Programmatic API

```ts
import { buildViewerData, formatConfigError, loadArchitecture } from 'graphinity'

const result = await loadArchitecture('architecture.yml', { projectRoot: '.' })
if (!result.ok) {
  for (const error of result.errors) console.error(formatConfigError(error))
} else {
  // { root, universes: { [id]: { id, name, direction, source, groups, nodes, edges } } }
  console.log(result.architecture.universes[result.architecture.root])
  // Named icons, resolved: architecture.json content, icon files to write, warnings.
  const { data, files, warnings } = await buildViewerData(result.architecture)
}
```

`result.files` lists every file read (configuration and icons), also when loading fails. Types
(`Architecture`, `Universe`, `ArchitectureNode`, `ArchitectureGroup`, `NodeTag`, `ConfigError`…)
are exported.

## Development

```sh
pnpm install
pnpm dev            # viewer (hot reload, on examples/kestrel) and documentation site, together
pnpm dev:viewer     # only the viewer
pnpm dev:docs       # only the documentation site
pnpm cli validate examples/kestrel/architecture.yml
pnpm typecheck
pnpm lint           # unused code (TypeScript compiler checks)
pnpm test           # unit tests (Vitest)
pnpm test:e2e       # builds, then browser tests with the installed Google Chrome (Playwright)
pnpm build          # dist/core, dist/cli and the precompiled dist/viewer
pnpm check:package  # npm pack, install the archive in a temporary project, run every command
```

Development needs Node.js 22.18 or later and pnpm 12 (pinned in `package.json`, selected by
Corepack). See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the workflow and the rules for pull
requests, and the documentation's
[Building and releasing](https://leptitbiscuit.github.io/Graphinity/project/releasing) page for
continuous integration and npm publication (tags `vX.Y.Z`, npm Trusted Publishing).

`GRAPHINITY_FILE=path/to/architecture.yml pnpm dev:viewer` shows another file during viewer
development. Each server prints its address (ports are chosen from 5173 upward);
`GRAPHINITY_PORT=8080 pnpm dev:viewer` (or `pnpm dev`) puts the viewer on a fixed port, an error
if it is taken. To serve your own diagram on another port, use [`graphinity dev --port`](#commands). Contributors (and coding agents) should read [`AGENTS.md`](AGENTS.md) first.

### Documentation site

The full documentation is a VitePress site in [`docs/`](docs):

```sh
pnpm dev:docs       # live preview, also started by pnpm dev (run pnpm docs:demo once to include the live demo)
pnpm docs:check     # validate every configuration example of the documentation
pnpm docs:build     # check, build the demo, build the static site (docs/.vitepress/dist)
pnpm docs:preview   # serve the built site
```

The site is also published for LLMs and AI assistants, generated from the same pages on every
build (`docs/scripts/llms.ts`): `llms.txt` (an index), `llms-full.txt` (the whole documentation in
one Markdown file) and a Markdown version of each page (`/config/node.md`). Each page has *Copy
page*, *View as Markdown*, *Copy all documentation* and *Download documentation* buttons. See
[Documentation for LLMs](https://leptitbiscuit.github.io/Graphinity/reference/llms).

Both can be shared through a Cloudflare quick tunnel (`cloudflared tunnel --url
http://localhost:<port>`, with the port they print): the live preview answers requests for
`<name>.trycloudflare.com` besides `localhost`.

## License

[Mozilla Public License 2.0](LICENSE). A built site contains the viewer, whose `index.html` keeps
a comment naming the license and the source code address. Icon collections keep their own licenses (Simple Icons and SVG Logos: CC0-1.0; Devicon and
VSCode Icons: MIT; Dashboard Icons: Apache-2.0 - texts in [`licenses/`](licenses); other Iconify
collections: see each collection, credited in the `icons/ATTRIBUTIONS.md` of every built site);
the brands the logos represent remain the property of their owners.
