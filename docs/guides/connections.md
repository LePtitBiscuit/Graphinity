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

## Mistakes to avoid

- `from`/`to` take **ids**, not names: `to: Website` is an error if the id is `site`.
- A connection starts from the universe that declares it: it can reach into a sub-universe with
  a path (`checkout/api`, see [Connecting to a sub-universe](/config/connection#connecting-to-a-sub-universe)),
  but not a node of a parent or unrelated file.
