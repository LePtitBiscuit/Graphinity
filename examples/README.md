# Examples

Each subdirectory holds a root architecture file and the sub-universe files it references.
They are used by the tests and as manual inputs:

```sh
npx graphinity dev examples/kestrel/architecture.yml
npx graphinity build examples/kestrel/architecture.yml --out site
```

## kestrel

*Kestrel Logistics*, a fictional e-commerce fulfilment and delivery group, nested over 16
universes and five levels:

```
architecture.yml                      Kestrel Logistics (people, Kestrel's systems, third-party services)
├─ edge/edge.yml                      Edge network (DNS, CDN, WAF, API gateway, load balancers)
├─ platform/platform.yml              Kestrel Platform (two regions, shared services)
│  ├─ platform/clusters/eu-west.yml   eu-west-1 cluster (groups nested on 4 levels)
│  │  ├─ platform/services/checkout.yml   Checkout service (also opened from us-east)
│  │  │  └─ data/orders-db.yml        Orders database (level 5, in another folder)
│  │  ├─ platform/services/catalog.yml    Catalog service
│  │  └─ platform/services/routing.yml    Routing service (right to left)
│  ├─ platform/clusters/us-east.yml   us-east-1 cluster (standby; opens checkout.yml too)
│  └─ platform/observability.yml      Observability (icons downloaded from the Iconify API)
├─ data/data.yml                      Data platform (streaming, lakehouse, analytics)
│  └─ data/kafka.json                 Kafka cluster (a JSON file)
├─ warehouses/warehouses.yml          Warehouse network
│  ├─ warehouses/lyon.yml             Lyon hub (bottom to top, over a floor plan)
│  └─ warehouses/rotterdam.yml        Rotterdam returns centre
└─ delivery/delivery.yml              Software delivery (CI, GitOps, infrastructure as code)
```

It uses Simple Icons names (`kubernetes`, `postgresql`…), icons of the bundled collections
(`logos:slack-icon`, `devicon:docker`, `vscode-icons:file-type-avro`…), icons of other Iconify
collections (`mdi:warehouse`, `mdi:bell-ring`, `fluent-emoji-flat:eagle`… - downloaded from the
Iconify API the first time the diagram is built, then cached), a background image - its only
local image file - (`images/floor-plan.svg`, in the Lyon hub), custom background colors and grids, colored, dashed, dotted and frosted groups
nested up to 4 levels, corner tags, all four directions, styled connections (colors, dashes,
arrowheads, sides), connections to and from groups (`edge/edge.yml`: group → node,
`data/orders-db.yml`: node → group, `warehouses/lyon.yml`: group → group), connections that reach several levels down by path
(`platform/eu-west/checkout/api`, `warehouses/lyon/wms`) and node placement hints (`place: last`
on the image resizer of `platform/services/catalog.yml`, `after: dbt` on the notebooks of
`data/data.yml`).
See the [main README](../README.md#configuration) for the file format.
