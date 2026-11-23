# Complete examples

Every example of this documentation is checked against the engine when the documentation is
built. Copy any of them as a starting point.

## A SaaS product over three levels

::: code-group

```yaml [architecture.yml]
id: acme
name: Acme
nodes:
  - id: product
    name: Acme App
    icon: ./icons/acme.svg
    description: the product
    universe: ./product/product.yml
  - id: github
    name: GitHub
    icon: github
    description: code and CI
  - id: stripe
    name: Stripe
    icon: stripe
    description: billing
connections:
  - from: github
    to: product
    label: deploys
  - from: product
    to: stripe
    label: payments
```

```yaml [product/product.yml]
id: product
name: Acme App
groups:
  - id: vercel
    name: Vercel
    icon: vercel
nodes:
  - id: web
    name: Next.js
    icon: nextdotjs
    description: frontend
    group: vercel
  - id: api
    name: Hono
    icon: hono
    description: api routes
    group: vercel
  - id: db
    name: Database
    icon: postgresql
    tags: [€19/mo]
    universe: ./database.yml
connections:
  - from: web
    to: api
    label: RPC
  - from: api
    to: db
    label: SQL
```

```yaml [product/database.yml]
id: database
name: Database
direction: down
groups:
  - id: cluster
    name: Primary cluster
    color: blue
nodes:
  - id: primary
    name: Primary
    icon: postgresql
    group: cluster
    tags: [{ text: writes, corner: top-left }]
  - id: replica
    name: Replica
    icon: postgresql
    group: cluster
    border: dashed
  - id: backups
    name: Backups
    icon: backblaze
connections:
  - from: primary
    to: replica
    label: streaming
    style: dashed
  - from: primary
    to: backups
    label: nightly
```

:::

The layout of this project:

```
acme/
├── architecture.yml
├── icons/
│   └── acme.svg
└── product/
    ├── product.yml
    └── database.yml
```

## The same universe in JSON

```json [architecture.json]
{
  "id": "acme",
  "name": "Acme",
  "direction": "down",
  "nodes": [
    { "id": "github", "name": "GitHub", "icon": "github", "tags": ["CI"] },
    { "id": "app", "name": "Acme App", "icon": "nextdotjs", "color": "blue" }
  ],
  "connections": [{ "from": "github", "to": "app", "label": "deploys", "style": "dashed" }]
}
```

## The Kestrel Logistics example

The repository contains a complete example in `examples/kestrel` - the one shown in the
[live demo](/guide/demo): a fictional fulfilment and delivery group over 16 universes and five
levels, with YAML and JSON files, groups nested on 4 levels, all four directions, a background
image, local, bundled and downloaded icons, a universe opened from two clusters, and connections
that reach several levels down (`platform/eu-west/checkout/api`). Its files are described in
[File structure](/concepts/file-structure) and on the [live demo](/guide/demo#the-files-behind-it)
page.
