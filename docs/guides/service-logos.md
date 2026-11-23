# Use service logos

## Brand logos

Give a node the **Simple Icons slug** of the service:

```yaml [architecture.yml]
id: stack
name: Stack
nodes:
  - id: web
    name: Web
    icon: react
  - id: api
    name: API
    icon: fastapi
  - id: db
    name: Database
    icon: mongodb
  - id: queue
    name: Queue
    icon: rabbitmq
  - id: errors
    name: Errors
    icon: sentry
```

To find a slug, search the service on [simpleicons.org](https://simpleicons.org) and take the
name used in its URL: *Node.js* is `nodedotjs`, *Google Cloud* is `googlecloud`, *C++* is
`cplusplus`. Logos are bundled with the package and drawn in their brand colors.

If an icon does not exist, the node shows a generic icon and the commands print a warning:

```
warning architecture.yml nodes[0].icon: Icon "not-a-brand" (Simple Icons): not found. The generic icon is shown.
```

## Other collections

When a logo is missing from Simple Icons, or to get it in color, use another collection with a
prefix - `devicon:`, `logos:`, `vscode-icons:` or, for self-hosted applications, `dashboard:`:

```yaml [architecture.yml]
id: selfhosted
name: Self-hosted
groups:
  - id: server
    name: Proxmox
    icon: dashboard:proxmox
nodes:
  - id: proxy
    name: Reverse proxy
    icon: logos:nginx
  - id: media
    name: Jellyfin
    icon: dashboard:jellyfin
    group: server
  - id: cloud
    name: Nextcloud
    icon: dashboard:nextcloud
    group: server
  - id: compose
    name: Compose files
    icon: vscode-icons:file-type-docker
connections:
  - from: proxy
    to: media
  - from: proxy
    to: cloud
```

The first build downloads the `dashboard:` icons and caches them; the generated site contains only
the icons used, and works offline. All collections, names and licenses: [Icons](/config/icons).

## Generic icons

For components without a brand - a database, a queue, a load balancer, a server - use the
generic icons of any [Iconify collection](/config/icons#any-iconify-collection):

```yaml [architecture.yml]
id: backend
name: Backend
nodes:
  - id: lb
    name: Load balancer
    icon: tabler:arrows-split
  - id: api
    name: API servers
    icon: mdi:server-network
  - id: queue
    name: Job queue
    icon: carbon:queued
  - id: db
    name: Database
    icon: lucide:database
  - id: files
    name: Object storage
    icon: material-symbols:storage
connections:
  - from: lb
    to: api
  - from: api
    to: queue
  - from: api
    to: db
  - from: api
    to: files
```

They are downloaded from the Iconify API the first time, then cached.

## Your own logos

For an internal service, or a brand that Simple Icons does not have, use an image of your
project:

```
project/
├── architecture.yml
└── icons/
    └── billing.svg
```

```yaml [architecture.yml]
id: internal
name: Internal services
nodes:
  - id: billing
    name: Billing
    icon: ./icons/billing.svg
  - id: db
    name: Database
    icon: postgresql
connections:
  - from: billing
    to: db
```

- Formats: `.svg` (recommended), `.png`, `.webp`, `.jpg`, `.jpeg`.
- For bitmaps, use a square image of at least 96 × 96 px.
- The same image can be used from any universe of the project (mind the relative path, e.g.
  `../icons/billing.svg` from a sub-folder).

## Logos on groups

Groups take an `icon` too, shown before their name:

```yaml [architecture.yml]
id: hosting
name: Hosting
groups:
  - id: vercel
    name: Vercel
    icon: vercel
nodes:
  - id: web
    name: Web
    icon: nextdotjs
    group: vercel
```

Details: [Icons](/config/icons).
