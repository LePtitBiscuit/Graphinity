# Group

An item of `groups`: a labelled frame around some nodes of the universe. Nodes join a group
with their [`group`](/config/node) property.

| Property | Type | Required | Default | Description |
| -------- | ---- | -------- | ------- | ----------- |
| `id`     | id | **yes** | | Unique within the universe. Used by the `group` property of nodes. |
| `name`   | text, ≤ 200 characters | **yes** | | Shown at the top left of the frame. |
| `icon`   | [icon](/config/icons) | no | | Shown before the name (16 × 16 px). |
| `color`  | [color](/config/colors-and-styles#colors) | no | theme | Color of the frame: its border, its name, and a light tint of its background. |
| `border` | `solid` · `dashed` · `dotted` · `none` | no | `solid` | Border style of the frame. |
| `blur`   | number of px, 0 to 40 | no | | Blurs what is behind the frame - the universe [background](/config/universe#background) - like frosted glass. |
| `group`  | id | no | | The group this group is inside of. Groups nest up to 4 levels. |
| `background` | [color](/config/colors-and-styles#colors) · `none` | no | a light tint of `color` | Fill of the frame. `none`: no fill, only the border and the name. |

## Example

```yaml [architecture.yml]
id: hosting
name: Hosting
groups:
  - id: vercel
    name: Vercel
    icon: vercel
  - id: hetzner
    name: Hetzner
    icon: hetzner
    color: orange
    border: dashed
nodes:
  - id: next
    name: Next.js
    icon: nextdotjs
    group: vercel
  - id: worker
    name: Jobs
    icon: nodedotjs
    group: hetzner
  - id: storage
    name: Storage
    icon: minio
    group: hetzner
connections:
  - from: next
    to: worker
  - from: worker
    to: storage
```

## Groups inside groups

A group can be inside another group with its own `group` property: a cloud provider, a region in
it, a network in the region. The inner frame is laid out inside the outer one.

```yaml [architecture.yml]
id: azure
name: Azure
groups:
  - id: azure
    name: Microsoft Azure
    icon: logos:microsoft-azure
    color: blue
    background: none          # only the border and the name
  - id: region
    name: Region Japan East
    group: azure
    background: "#1a1d24"
  - id: vnet
    name: Virtual network
    group: region
nodes:
  - id: user
    name: User
    icon: tabler:user
  - id: front
    name: Front Door
    icon: logos:azure-icon
    group: azure
  - id: app
    name: App Service
    icon: devicon:azure
    group: region
  - id: sql
    name: SQL Database
    icon: devicon:azuresqldatabase
    group: vnet
connections:
  - from: user
    to: front
    label: HTTPS
  - from: front
    to: app
  - from: app
    to: sql
    label: SQL
```

## Rules

- A node belongs to one group at most. A group is inside one group at most, 4 levels deep at
  most, and never inside itself.
- A group without any node - directly or in a group inside it - is an error:
  `Group "x" has no nodes`.
- A group's `group` that is not declared is an error: `Unknown group "x" (declare it in "groups")`;
  the group is then shown at the top level. So are a group inside itself
  (`Group "x" cannot be inside itself`), groups inside each other
  (`Groups inside each other: a → b → a`) and a group too deep
  (`Group "x" is nested too deep: a → b → c → d → x (max 4 levels)`).
- A node whose `group` is not declared is an error:
  `Unknown group "x" (declare it in "groups")`.
- A group can be an end of a connection (from a node, to a node, to another group): see
  [Connecting groups](/config/connection#connecting-groups).
- In the viewer, dragging a group moves its nodes and the groups inside it; a node, or a group,
  cannot be dragged out of its group.
