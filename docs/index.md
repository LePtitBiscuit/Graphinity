---
layout: home

hero:
  name: Graphinity
  text: Recursive architecture diagrams from YAML
  tagline: Describe each level of your system in its own file, link the levels together, and explore the result as an interactive diagram - locally, or as a static site.
  image:
    src: /logo.svg
    alt: Graphinity
  actions:
    - theme: brand
      text: Get started
      link: /guide/quick-start
    - theme: alt
      text: Live demo
      link: /guide/demo
    - theme: alt
      text: Configuration
      link: /config/

features:
  - icon: 🗂️
    title: Files are the source of truth
    details: Plain YAML or JSON files, validated strictly. No editor, no database, no coordinates to maintain.
  - icon: 🪆
    title: Recursive universes
    details: Any node can open another file. Double-click it to go one level down - without any depth limit.
  - icon: 📐
    title: Automatic layout
    details: Every universe is laid out with ELK - orthogonal connections, arrows and labels, in the direction you choose.
  - icon: 🏷️
    title: Real logos, groups and tags
    details: Any icon of the 200+ Iconify collections - generic icons and logos - Dashboard Icons, or your own images, bundled into the site. Plus frames around nodes and corner tags.
  - icon: ⚡
    title: Live reload with precise errors
    details: The dev server reloads on every save and reports each problem with its file, line, column and field.
  - icon: 📦
    title: Static build
    details: One command produces a standalone site that runs on any static host, without backend.
---

## A diagram in two files

::: code-group

```yaml [architecture.yml]
id: platform
name: My platform
nodes:
  - id: web
    name: Web app
    icon: vuedotjs
  - id: api
    name: API
    icon: nodedotjs
    description: REST API
    universe: ./api.yml # double-click to open api.yml
connections:
  - from: web
    to: api
    label: HTTPS
```

```yaml [api.yml]
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

:::

```sh
npx graphinity dev architecture.yml
```

The browser opens on *My platform*. Double-click **API** to open its own universe; the breadcrumb
takes you back. [Follow the quick start →](/guide/quick-start)
