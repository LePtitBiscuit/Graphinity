# Universe

The top level of every configuration file.

| Property    | Type | Required | Default | Description |
| ----------- | ---- | -------- | ------- | ----------- |
| `id`        | id | **yes** | | Identifier, unique across the whole project. Appears in the viewer's URL. |
| `name`      | text, ≤ 200 characters | **yes** | | Title of the universe, shown in the breadcrumb. |
| `direction` | `right` · `down` · `left` · `up` | no | `right` | Where connections flow. See [Automatic layout](/concepts/layout#direction). |
| `background` | [background](#background) | no | | Image or color behind the diagram. |
| `groups`    | list of [Group](/config/group) | no | `[]` | Frames around some nodes. |
| `nodes`     | list of [Node](/config/node) | **yes** | | The nodes. May be empty: `nodes: []`. |
| `connections` | list of [Connection](/config/connection) | no | `[]` | Connections between nodes of this universe. |

## Example

```yaml [architecture.yml]
id: platform
name: Platform
direction: down
groups:
  - id: data
    name: Data
nodes:
  - id: api
    name: API
    icon: nodedotjs
  - id: db
    name: PostgreSQL
    icon: postgresql
    group: data
connections:
  - from: api
    to: db
    label: SQL
```

## Rules

- `id` must be unique **in the project**: two files with the same `id` are an error
  (`Universe id "root" is already used by architecture.yml`).
- Node ids and group ids must be unique **within** the universe.
- `nodes` is required, even when empty. An empty universe is valid and is shown as
  *This universe is empty.*
- Each universe has its own `direction`; sub-universes do not inherit it.

## Background

`background` puts an image, a color, or both, behind the diagram. It is a fixed wallpaper: it
covers the screen and does not move when you pan or zoom.

| Property | Type | Description |
| -------- | ---- | ----------- |
| `image`  | path to an image | Local image (`.svg`, `.png`, `.webp`, `.jpg`, `.jpeg`), relative to the file, inside the project - the same rules as [local icons](/config/icons#local-images). Shown to cover the screen, centred. |
| `color`  | [color](/config/colors-and-styles#colors) | Color behind the diagram (and behind the image, while it loads). |
| `blur`   | number of px, 0 to 40 | Blurs the image. |
| `grid`   | `true` · `false` · [color](/config/colors-and-styles#colors) | Shows the grid on the canvas - in this color when a color is given (`'#ffffff22'`). Default: `true`, or `false` when there is an `image`. |

```yaml [architecture.yml]
id: office
name: Office
background:
  image: ./images/office.jpg
  blur: 8
  color: '#0b1220'
groups:
  - id: lan
    name: LAN
    color: teal
    blur: 12          # frosted glass over the wallpaper
nodes:
  - id: nas
    name: NAS
    icon: synology
    group: lan
  - id: router
    name: Router
    icon: mdi:router-wireless
    group: lan
connections:
  - from: router
    to: nas
```

- The background belongs to its universe: each universe can have its own, and sub-universes do
  not inherit it.
- The grid is shown by default, and hidden over an image; `grid` chooses. In the viewer, the
  grid button of the controls (bottom left) shows or hides it too, for the session (not saved).

```yaml
background:
  grid: false       # a plain canvas, without grid
```

```yaml
background:
  grid: '#4f8cff33' # a blue grid (translucent)
```
- `build` copies the image to `files/` with the local icons. An invalid image (missing file,
  unsafe SVG…) is an error; the color and blur still apply.
- Prefer images that keep the diagram readable: dark or blurred backgrounds work best.
