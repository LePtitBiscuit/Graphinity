<script setup>
import { withBase } from 'vitepress'
</script>

# Live demo

This is the real viewer, built with `graphinity build` from the
**Kestrel Logistics** example of the repository (`examples/kestrel`): a fictional fulfilment and
delivery group described over 16 universes and five levels, from the people who use it down to
the replicas of one database.

Try it: click a node, double-click **Kestrel Platform**, then **eu-west-1**, **Checkout** and
**Orders DB**; follow a door (`↩ …`) back up, drag a node, use the breadcrumb.

<iframe class="demo-frame" :src="withBase('/demo/')" title="Kestrel Logistics, rendered by Graphinity" loading="lazy"></iframe>

<p><a :href="withBase('/demo/')" target="_blank" rel="noopener">Open the demo in a new tab ↗</a></p>

## The files behind it

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

- `architecture.yml` - the root, left to right on a dark background: the people (customers,
  merchants, couriers), Kestrel's own systems (edge, platform, data, warehouses, software
  delivery: each opens its own universe) and third-party services (Stripe, Sentry, PagerDuty,
  Slack). Its connections reach deep into the sub-universes by path
  (`platform/eu-west/checkout/api`, `data/kafka/orders`, `warehouses/lyon/wms`).
- `edge/edge.yml` - DNS, CDN, WAF, API gateway and load balancers, in groups inside a
  *Cloudflare* group.
- `platform/platform.yml` - drawn top to bottom: the two regions and the shared services.
  `platform/clusters/eu-west.yml` nests groups on the maximum of 4 levels (cluster ›
  applications › commerce namespace › checkout node pool); `us-east.yml` is the standby copy.
- `platform/services/checkout.yml` - one universe opened from both clusters. Its `db` node opens
  `data/orders-db.yml`, the fifth level, stored in another folder. `catalog.yml` (its `images`
  node, the image resizer, uses the [placement hint](/config/node#placement-hints) `place: last`) and
  `routing.yml` (drawn right to left) are the other services; `observability.yml` uses icons
  downloaded from the Iconify API (`mdi:…`).
- `data/data.yml` - streaming, lakehouse and analytics; its `kafka` node opens `kafka.json`, a
  universe written in JSON. Its `notebooks` node uses the placement hint `after: dbt`.
- `warehouses/warehouses.yml` - Lyon opens `lyon.yml` (drawn bottom to top over a floor plan,
  `images/floor-plan.svg`, with frosted groups and `mdi:` icons for the warehouse floor),
  Rotterdam opens `rotterdam.yml`, Newark opens nothing yet.
- `delivery/delivery.yml` - GitHub, CI, Argo CD and Terraform, with icons of the bundled
  collections (`devicon:`, `vscode-icons:`).

Every icon of the example is a [named icon](/config/icons): bundled logos and icons of other
Iconify collections (`mdi:`, `fluent-emoji-flat:eagle` for Kestrel itself), downloaded from the
Iconify API the first time the diagram is built, then cached. The only local image is the
background of the Lyon hub.

The demo is generated when the documentation is built:

```sh
graphinity build examples/kestrel/architecture.yml --out docs/public/demo
```
