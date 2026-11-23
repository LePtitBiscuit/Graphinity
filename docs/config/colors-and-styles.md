# Colors and styles

## Colors

The `color` of a node, a group or a connection - the `background` of a node or a group, the
`color` and `grid` of a universe's `background` - is either:

- a **hexadecimal color**: `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` - `#4f8cff`, `#f80`,
  `#4f8cff80`;
- one of these **names**, chosen to read well on the dark canvas (case-insensitive):

| Name     | Value     | Name     | Value     |
| -------- | --------- | -------- | --------- |
| `gray`   | `#8a93a5` | `yellow` | `#d29922` |
| `white`  | `#e6e9ef` | `orange` | `#f0883e` |
| `blue`   | `#4f8cff` | `red`    | `#f85149` |
| `teal`   | `#2fb8ac` | `pink`   | `#db61a2` |
| `green`  | `#3fb950` | `purple` | `#a371f7` |

Any other value - CSS names, `rgb()`, functions - is an error:

```
architecture.yml:7:12 nodes[0].color: "color" must be a hex color (#4f8cff) or one of gray, white, blue, teal, green, yellow, orange, red, pink, purple, got "rgb(1,2,3)"
```

In YAML, quote hexadecimal colors (`color: "#4f8cff"`): an unquoted `#` starts a comment.

What `color` changes:

| On | Effect |
| -- | ------ |
| [Node](/config/node) | Border of the tile. |
| [Group](/config/group) | Border of the frame, its name, and a light tint of its background. |
| [Connection](/config/connection) | Line and arrowheads. |

`background` fills the tile of a [node](/config/node) (translucent colors such as
`'#3fb95026'` give a tint) or the frame of a [group](/config/group) (`none`: no fill), or sits
behind the diagram of a [universe](/config/universe#background).

## Sizes

`size` on a node: `small`, `medium` (default) or `large` - tiles of 40, 56 and 80 px.

## Blur

`blur`, in pixels from 0 to 40:

| On | Effect |
| -- | ------ |
| Universe [`background`](/config/universe#background) | Blurs the background image. |
| [Group](/config/group) | Blurs what is behind the frame (frosted glass over the background). |

## Border styles

`border` on a node (its tile) or a group (its frame):

| Value | Look |
| ----- | ---- |
| `solid` (default) | continuous line |
| `dashed` | dashes |
| `dotted` | dots |
| `none` | no border |

## Line styles

`style` on a connection:

| Value | Look |
| ----- | ---- |
| `solid` (default) | continuous line |
| `dashed` | dashes - e.g. optional or asynchronous links |
| `dotted` | dots |

## Arrowheads

`arrow` on a connection:

| Value | Arrowheads |
| ----- | ---------- |
| `end` (default) | on the `to` side |
| `start` | on the `from` side |
| `both` | on both ends |
| `none` | none |

## Example

```yaml [architecture.yml]
id: styles
name: Styles
groups:
  - id: edge
    name: Edge network
    icon: cloudflare
    color: orange
    border: dashed
nodes:
  - id: cdn
    name: CDN
    icon: cloudflare
    group: edge
  - id: app
    name: App
    icon: nodedotjs
    color: "#3fb950"
    background: "#3fb95026"
    size: large
  - id: legacy
    name: Legacy
    icon: php
    border: dotted
connections:
  - from: cdn
    to: app
    color: blue
  - from: app
    to: legacy
    style: dashed
    arrow: both
```
