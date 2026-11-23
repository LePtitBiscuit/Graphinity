# Tags

The `tags` of a node: up to **four** short texts, one per corner of its tile - a price, a version,
an environment, a status.

A tag is either:

- **a text or a number** - placed on the first free corner;
- **a mapping** with these properties:

| Property | Type | Required | Default | Description |
| -------- | ---- | -------- | ------- | ----------- |
| `text`   | text or number, ≤ 40 characters | **yes** | | The text shown. |
| `corner` | `top-right` · `top-left` · `bottom-right` · `bottom-left` | no | first free corner | Where the tag goes. |

## Corner order

Tags without a `corner` take the free corners in this order:

1. `top-right`
2. `top-left`
3. `bottom-right`
4. `bottom-left`

Corners chosen explicitly are taken first, whatever their position in the list.

## Example

```yaml [architecture.yml]
id: data
name: Data
nodes:
  - id: db
    name: PostgreSQL
    icon: postgresql
    tags:
      - €24/mo                                # top-right
      - 16                                    # top-left (numbers are accepted)
      - { text: primary, corner: bottom-left }
  - id: cache
    name: Redis
    icon: redis
    tags: [{ text: beta, corner: top-left }, v7]   # v7 goes top-right
```

## Rules

- At most 4 tags: `A node has at most 4 tags (one per corner), got 5`.
- Two tags cannot use the same corner: `Corner "top-left" is already used by tag 2`.
- Empty tags and texts over 40 characters are errors. On screen, a long tag is shortened with
  "…"; hover it, or open the details panel, to read it in full.
