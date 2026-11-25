# Sub-universes and navigation

A node can **open another universe**: give it a `universe` field with the path of the file. The
opened universe is complete on its own, and its nodes can open further universes - **without
depth limit**.

::: code-group

```yaml [architecture.yml]
id: company
name: Company
nodes:
  - id: platform
    name: Platform
    icon: kubernetes
    universe: ./platform/platform.yml
```

```yaml [platform/platform.yml]
id: platform
name: Platform
nodes:
  - id: cluster
    name: Cluster
    icon: kubernetes
    universe: ./cluster.yml
```

```yaml [platform/cluster.yml]
id: cluster
name: Cluster
nodes:
  - id: ingress
    name: Ingress
    icon: nginx
  - id: app
    name: App
    icon: docker
connections:
  - from: ingress
    to: app
```

:::

## Connections across universes

A sub-universe shows how it is connected to the universes above it:

- **Doors.** The nodes of the parent connected to the node that opens the universe appear in it
  as large, translucent nodes (frosted glass, dashed outline), named after their universe
  (`↩ Platform`): those the
  connections come from at the start of the flow (left, or top with `direction: down`), those
  they go to at the end. **Clicking a door goes back to its universe.** Without any such node, a
  single door leads back to the parent.
- **Connections into the sub-universe.** In the parent file, an end of a connection can name a
  node *inside* the universe of a node, with a path: `cluster/app` is the node `app` of the
  universe opened by `cluster`. The parent draws it on the `cluster` node; the sub-universe
  draws it from (or to) the door, on `app` itself. The path can also end on a group of that
  universe (`cluster/workers`): the sub-universe draws the connection to the frame of the group
  (see [A group of a sub-universe](/config/connection#a-group-of-a-sub-universe)).

::: code-group

```yaml [architecture.yml]
id: platform
name: Platform
nodes:
  - id: ci
    name: CI
    icon: githubactions
  - id: cluster
    name: Cluster
    icon: kubernetes
    universe: ./cluster.yml
  - id: backups
    name: Backups
    icon: mdi:backup-restore
connections:
  - from: ci
    to: cluster/app          # app, inside the universe of cluster
    label: deploy
  - from: { node: cluster/db, side: right }
    to: backups
```

```yaml [cluster.yml]
id: cluster
name: Cluster
nodes:
  - id: ingress
    name: Ingress
    icon: nginx
  - id: app
    name: App
    icon: docker
  - id: db
    name: Database
    icon: postgresql
connections:
  - from: ingress
    to: app
  - from: app
    to: db
```

:::

In *Platform*: `CI → Cluster → Backups`. In *Cluster*: a `CI` door on the left with `deploy` to
*App*, and *Database* to a `Backups` door on the right.

- Paths go down several levels (`platform/cluster/app`), up to 8, and work in the
  [`{ node, side }`](/config/connection#ends-and-sides) form.
- Doors and connections depend on the path taken: a universe opened from two places shows the
  connections of the parent it was opened from.

## Navigating with the scroll wheel

- **In**: zoom in to the maximum and keep scrolling: an *Opening …* bar fills (at the bottom, and
  in the tile of the node) with the amount scrolled - about five notches of the wheel - while the
  diagram moves towards the node and fades; then the universe opens, coming from afar. No need
  to point exactly at the node: when only one node of the universe opens a universe, it is that
  one, wherever the pointer is; otherwise, the one under the mouse cursor, or the closest to it.
  Moving the cursor to another node starts the bar over for that node.
- **Out**: zoom out a little beyond the whole universe (to 60 % of the zoom that fits it), then
  keep zooming out: a *Back to …* bar fills at the bottom (about five notches) while the diagram
  moves away; then the parent comes back.
- Stopping for a moment cancels the bar, and the diagram settles back. While the bar fills, the
  zoom does not change. After a change of universe, scrolling must pause before it can start
  another one.
- The doors, the breadcrumb and the back button lead out at once - useful in large universes.

## Paths

- A path is **relative to the file that contains it**: in `platform/platform.yml`,
  `./cluster.yml` means `platform/cluster.yml`.
- It must point to a `.yml`, `.yaml` or `.json` file **inside the project directory** (the root
  file's directory, or the one given with [`--project`](/cli/#the-project-directory)).
- Absolute paths, URLs, and paths leaving the project (also through symbolic links) are errors.

## Sharing and cycles

- **A universe can be shared**: several nodes, in the same or different files, may open the same
  file. It is loaded once; this is not a cycle. The viewer opens it from each of these nodes with
  that node's context: its doors and the connections that reach into it come from the node you
  opened it through, and the breadcrumb and back button return where you came from.

```yaml
# Two deployments of the same service: both nodes open services/checkout.yml.
nodes:
  - id: checkout
    name: Checkout
    icon: typescript
    universe: ./services/checkout.yml
  - id: checkout-canary
    name: Checkout canary
    icon: typescript
    universe: ./services/checkout.yml
connections:
  - from: checkout-canary/api # reaches into the shared universe through the canary
    to: checkout/api
    label: shadow traffic
```
- **Cycles are errors**: a universe cannot lead back to one of the universes that lead to it. The
  error shows the chain, for example
  `architecture.yml → sub.yml → architecture.yml`.
- Universe ids must be unique across the project.

## Navigating in the viewer

| Action | Effect |
| ------ | ------ |
| Double-click a doubled node | Opens its universe. *Open* in the details panel does the same. |
| Breadcrumb (top left) | Goes back to any parent level. |
| Back button | Goes up one level. |
| Browser back / forward | Follow your navigation history. |

The current path is kept in the URL, as universe ids after the root:
`#/platform/cluster`. When several nodes of one universe open the same universe, a step opened
through any of them but the first also names that node, after a `~`:
`#/platform/cluster/checkout~checkout-canary`. Reloading the page or sharing the link opens the
same level, through the same node. An invalid path (for example after renaming a universe or a
node) opens its longest valid part.

Each universe is fitted to the screen the first time you open it, and keeps its zoom and
position when you come back to it the same way during the session.
