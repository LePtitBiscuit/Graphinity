# Configuration overview

Each configuration file describes one [universe](/config/universe). This section is the
reference of every property the engine accepts - nothing else is accepted.

## The objects

```
Universe                     a file
├── groups: Group[]          frames around nodes
├── nodes: Node[]            the things in the universe
│   └── tags: Tag[]          short texts on the corners of a node
└── connections: Connection[]  arrows between nodes
```

| Object | Properties |
| ------ | ---------- |
| [Universe](/config/universe) | `id`, `name`, `direction`, `background`, `groups`, `nodes`, `connections` |
| [Universe background](/config/universe#background) | `image`, `color`, `blur`, `grid` |
| [Node](/config/node) | `id`, `name`, `icon`, `description`, `universe`, `group`, `tags`, `color`, `border`, `background`, `size`, `place`, `after` |
| [Connection](/config/connection) | `from`, `to`, `label`, `color`, `style`, `arrow` |
| [Connection end](/config/connection#ends-and-sides) | a node id or path, or `node`, `side` |
| [Group](/config/group) | `id`, `name`, `icon`, `color`, `border`, `blur`, `group`, `background` |
| [Tag](/config/tags) | a text or a number, or `text`, `corner` |

Shared value formats: [icons](/config/icons) and [colors](/config/colors-and-styles).

## General rules

- **Unknown properties are errors.** A typo such as `descripton` is reported with the list of the
  allowed properties.
- **Missing and `null` mean "not set".** An optional property set to `null` takes its default.
- **Texts must be strings and not blank.** `name: 2024` is an error (write `name: "2024"`);
  `name: "  "` too. Only [tags](/config/tags) also accept numbers.
- **Identifiers** (`id` of universes, nodes and groups) contain letters, digits, `.`, `_` and `-`,
  start with a letter or a digit, and are at most 100 characters long: `api`, `lyon-hub`,
  `db.primary`.
- **Paths** (`universe`, local `icon`, background `image`) are relative to the file that contains them and stay
  inside the project directory.
- **Order**: the order of properties does not matter; the order of nodes guides the layout
  between equivalent placements. Positions are computed: a node can only take a
  [placement hint](/config/node#placement-hints) (`place`, `after`), never coordinates.

## Minimal file

```yaml [architecture.yml]
id: minimal
name: Minimal
nodes: []
```

Every limit and validation rule is listed in [Validation and limits](/config/validation).
