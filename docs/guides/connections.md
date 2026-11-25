# Add connections

Connections are listed under `connections`. Each one goes `from` a node `to` another, by id.

```yaml [architecture.yml]
id: blog
name: My blog
nodes:
  - id: cms
    name: CMS
    icon: strapi
  - id: site
    name: Website
    icon: astro
  - id: host
    name: Hosting
    icon: netlify
connections:
  - from: cms
    to: site
    label: content API
  - from: site
    to: host
    label: deploy
```

The nodes now follow the flow: `cms`, then `site`, then `host`.

## Labels, colors and arrows

```yaml [architecture.yml]
id: blog
name: My blog
nodes:
  - id: cms
    name: CMS
    icon: strapi
  - id: site
    name: Website
    icon: astro
  - id: host
    name: Hosting
    icon: netlify
  - id: analytics
    name: Analytics
    icon: plausibleanalytics
connections:
  - from: cms
    to: site
    label: webhook
    style: dashed        # asynchronous
  - from: site
    to: host
    label: deploy
    color: blue
  - from: site
    to: analytics
    style: dotted
    arrow: none          # no arrowhead
```

All the options: [Connection](/config/connection) and
[Colors and styles](/config/colors-and-styles).

## Two-way links and loops

Use `arrow: both` for a two-way link drawn once. If you write two connections in opposite
directions (`a → b` and `b → a`), the layout keeps the nodes in place and draws the second one
against the flow - see [Automatic layout](/concepts/layout#order-along-the-flow).

## Connect to a group

An end can be a [group](/config/group): the connection attaches to its frame, once for the whole
group, instead of one connection per node.

```yaml [architecture.yml]
id: shop
name: Shop
groups:
  - id: backend
    name: Backend
nodes:
  - id: web
    name: Storefront
    icon: vuedotjs
  - id: api
    name: API
    icon: nodedotjs
    group: backend
  - id: db
    name: Database
    icon: postgresql
    group: backend
connections:
  - from: web
    to: backend          # the frame of the group
    label: HTTPS
  - from: api
    to: db
```

A group of a sub-universe works the same way, with a path:
`to: integrations/business` (see [A group of a sub-universe](/config/connection#a-group-of-a-sub-universe)).

## Keep two nodes side by side

A connection places its target one layer further along the flow. To link two nodes of the same
row (or column) without moving either, set `align: true`:

```yaml [architecture.yml]
id: company
name: Company
direction: down
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
connections:
  - from: holding
    to: shop             # below the holding
  - from: shop
    to: crm              # on the row of the shop, straight across
    align: true
```

To put a node in the layer of another one without a connection, use the placement hint
[`beside`](/config/node#side-by-side).

## Mistakes to avoid

- `from`/`to` take **ids**, not names: `to: Website` is an error if the id is `site`.
- A connection starts from the universe that declares it: it can reach into a sub-universe with
  a path (`checkout/api`, see [Connecting to a sub-universe](/config/connection#connecting-to-a-sub-universe)),
  but not a node of a parent or unrelated file.
- The arrowheads (`arrow`) do not change the order of the nodes: `to` is always placed further
  along the flow, unless the connection has `align: true`.
