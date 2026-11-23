# Nest universes

Split a system over several levels: each level is a file, and a node opens the next one.

## 1. Plan the levels

For example: the **company**, then its **platform**, then the **server** that runs it.

```
company/
├── architecture.yml        company
└── platform/
    ├── platform.yml        platform
    └── server.yml          server
```

## 2. Write the levels

::: code-group

```yaml [architecture.yml]
id: company
name: Company
nodes:
  - id: platform
    name: Platform
    icon: kubernetes
    description: our product
    universe: ./platform/platform.yml
  - id: github
    name: GitHub
    icon: github
connections:
  - from: github
    to: platform
    label: deploys
```

```yaml [platform/platform.yml]
id: platform
name: Platform
nodes:
  - id: server
    name: Server
    icon: ubuntu
    universe: ./server.yml
  - id: backups
    name: Backups
    icon: backblaze
connections:
  - from: server
    to: backups
    label: nightly
```

```yaml [platform/server.yml]
id: server
name: Server
direction: down
nodes:
  - id: nginx
    name: Nginx
    icon: nginx
  - id: api
    name: API
    icon: nodedotjs
  - id: db
    name: PostgreSQL
    icon: postgresql
connections:
  - from: nginx
    to: api
  - from: api
    to: db
```

:::

Note how paths are relative to each file: `architecture.yml` opens `./platform/platform.yml`,
which opens `./server.yml` - in its own folder.

## 3. Navigate

```sh
npx graphinity dev architecture.yml
```

- **Platform** is drawn doubled: double-click it, then double-click **Server**.
- The breadcrumb reads `Company / Platform / Server`; click a level to go back to it.
- The URL ends with `#/platform/server`: share it to open that level directly.

## Good to know

- There is no depth limit.
- A universe can be opened by several nodes (a shared database, for instance).
- A connection can reach a node inside a sub-universe with a path (`platform/server`): see
  [Connections across universes](/concepts/sub-universes#connections-across-universes).
- A universe cannot lead back to one of its parents: that is a
  [circular reference](/cli/errors#circular-reference).
- Universe ids must be unique across all files.
