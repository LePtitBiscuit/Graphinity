# Universes

A **universe** is one level of your architecture, drawn as one diagram. **One file is one
universe.**

```yaml [architecture.yml]
id: shop
name: Online shop
nodes:
  - id: web
    name: Storefront
    icon: nextdotjs
  - id: payments
    name: Payments
    icon: stripe
connections:
  - from: web
    to: payments
```

Every universe has:

| Field       | Meaning |
| ----------- | ------- |
| `id`        | Its identifier, **unique in the whole project**. It appears in the viewer's URL. |
| `name`      | Its title, shown in the breadcrumb. |
| `nodes`     | What it contains (may be empty). |
| `connections` | The connections between its nodes (optional). |
| `direction` | Where connections flow - left to right by default (optional). |
| `groups`    | Frames around some of its nodes (optional). |
| `background` | An image, a color and a grid behind its diagram (optional). |

See the full [Universe reference](/config/universe).

## The root universe

Commands take **one file**: the *root universe*. Everything reachable from it is loaded -
through the `universe` field of its nodes, then the nodes of those universes, and so on. Files
that nothing points to are ignored.

## What a universe is for

Choose universes the way you would zoom on a map:

- an **organisation** universe with its products and external services;
- a **product** universe with its components;
- a **server** or **cluster** universe with the services that run on it.

Each level stays small and readable; details live one level down, in
[sub-universes](/concepts/sub-universes).

## One universe at a time

The viewer always shows a single universe. Its layout is computed automatically when you open
it (see [Automatic layout](/concepts/layout)); you never write positions.
