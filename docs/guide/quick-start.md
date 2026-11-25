# Quick start

In five minutes: a two-level diagram, previewed in your browser.

## The fastest way: `init`

In an empty folder, create a starter project and open it:

```sh
npx graphinity init
npx graphinity dev architecture.yml
```

```
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

`init` writes three things (`npx graphinity init my-architecture` puts them in a new
`my-architecture/` folder instead):

```
.
├── architecture.yml        ← the root universe "My system": web, api, database
├── universes/
│   └── example.yml         ← the universe inside the "api" node: server, queue, worker
└── assets/
    └── icons/              ← empty: put your own SVG logos here
```

- `architecture.yml` is the **root universe**: the first level you see. Its `api` node has
  `universe: ./universes/example.yml`, so it opens the second file.
- `universes/example.yml` is a **sub-universe**: what is inside the API.
- Its connections show both kinds of ends: a node of the same universe (`database`) and a
  [path into a sub-universe](/config/connection#connecting-to-a-sub-universe) (`api/server`).
- The icons are logos bundled with the package: the project works offline.

It never overwrites existing files without asking: see [`init`](/cli/init) for the generated
files and the options. `dev` opens the diagram in your browser (see
[step 4](#_4-open-the-diagram) for what you can do there); edit a file and save it: the page
updates by itself.

## Or write the files yourself

The steps below build a similar project by hand, to see what each line does.

## 1. Write the root universe

Create a folder for your project and, in it, a file named `architecture.yml`:

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
    description: REST API and jobs
    universe: ./api.yml
connections:
  - from: web
    to: api
    label: HTTPS
```

- `id` and `name` describe the universe.
- Each node has an `id`, a `name` and an `icon` - here, names of logos from
  [Simple Icons](/config/icons).
- `universe: ./api.yml` makes the **API** node open another file.
- `connections` draws an arrow from `web` to `api`.

## 2. Write the sub-universe

Next to it, create `api.yml`:

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
  - id: cache
    name: Redis
    icon: redis
connections:
  - from: server
    to: db
    label: SQL
  - from: server
    to: cache
```

## 3. Check the files

```sh
npx graphinity validate architecture.yml
```

```
✓ Valid: 2 universes, 5 nodes, 3 connections
```

If something is wrong, every problem is listed with its location - see
[Common errors](/cli/errors).

## 4. Open the diagram

```sh
npx graphinity dev architecture.yml
```

```
10:42:07 ✓ 2 universes, 5 nodes, 3 connections

  Graphinity 0.1.3  http://127.0.0.1:4321/
  Watching architecture.yml and the files it references. Ctrl+C to stop.
```

Your browser opens on *My platform*:

- **click** a node to see its details;
- **double-click** **API** (drawn doubled: it contains a universe) to open `api.yml`;
- use the **breadcrumb** or the **back** button to go up.

Edit a file and save it: the page updates by itself.

## 5. Share it

```sh
npx graphinity build architecture.yml
```

writes a static site to `dist/`. Upload it to any static host -
see [Build and host a static site](/guides/static-hosting).

## Next steps

- Learn the [concepts](/concepts/universes): universes, nodes, connections, sub-universes.
- Browse the [configuration reference](/config/).
- Look at the [live demo](/guide/demo).
