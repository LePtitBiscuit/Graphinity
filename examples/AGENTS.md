# AGENTS.md - examples

Example projects, described for users in [`README.md`](README.md). Read the
[root guide](../AGENTS.md) first.

## kestrel

*Kestrel Logistics*, a fictional fulfilment and delivery group over 16 universes and five
levels, linked by `universe` fields:

| File | Universe | Links |
| ---- | -------- | ----- |
| `architecture.yml` | `kestrel` (root, left to right, custom background; paths deep into the sub-universes: `edge/cdn`, `platform/eu-west/checkout/api`, `data/kafka/orders`, `warehouses/lyon/wms`, `platform/observability/alertmanager`) | `edge`, `platform`, `data`, `warehouses`, `delivery` → their folder's file |
| `edge/edge.yml` | `edge` (groups inside a `cloudflare` group) | none (leaf) |
| `platform/platform.yml` | `platform` (top to bottom; paths two levels down: `eu-west/checkout/db/primary`, `eu-west/checkout/db/backup`) | `eu-west`, `us-east` → `clusters/*.yml`; `observability` → `observability.yml` |
| `platform/clusters/eu-west.yml` | `eu-west` (grid, groups nested on the maximum of 4 levels) | `catalog`, `checkout`, `routing` → `../services/*.yml` |
| `platform/clusters/us-east.yml` | `us-east` (tinted grid) | `checkout` → `../services/checkout.yml` (the same file as eu-west) |
| `platform/observability.yml` | `observability` (Iconify `mdi:` icons, downloaded) | none (leaf) |
| `platform/services/checkout.yml` | `checkout` (top to bottom; shared by both clusters) | `db` → `../../data/orders-db.yml` (another folder) |
| `platform/services/catalog.yml` | `catalog` (no groups; placement hint `place: last` on `images`) | none (leaf) |
| `platform/services/routing.yml` | `routing` (right to left) | none (leaf) |
| `data/data.yml` | `data` (custom background color and grid; placement hint `after: dbt` on `notebooks`) | `kafka` → `kafka.json` |
| `data/kafka.json` | `kafka` (JSON, top to bottom) | none (leaf) |
| `data/orders-db.yml` | `orders-db` (level 5, bottom to top, nested groups) | none (leaf) |
| `warehouses/warehouses.yml` | `warehouses` (path between two sub-universes: `rotterdam/restock` → `lyon/wms`) | `lyon` → `lyon.yml`, `rotterdam` → `rotterdam.yml`; `newark` opens nothing |
| `warehouses/lyon.yml` | `lyon-hub` (bottom to top, background image, frosted groups, `mdi:` icons) | none (leaf) |
| `warehouses/rotterdam.yml` | `rotterdam-returns` (top to bottom) | none (leaf) |
| `delivery/delivery.yml` | `delivery` (bundled collections: `devicon:`, `vscode-icons:`) | none (leaf) |
| `images/` | `floor-plan.svg`, background image of the Lyon hub (the only local image) | |

Icons are named icons only: Simple Icons, the bundled collections (`logos:`, `devicon:`,
`vscode-icons:`) and other Iconify collections (`mdi:`, `fluent-emoji-flat:eagle` for the Kestrel
group and the `platform` node), downloaded from the Iconify API on the first build, then cached.

## Rules

- The maintainer edits these files to try features: keep their changes, and add to them rather
  than rewrite them.
- They must stay valid: `pnpm cli validate examples/kestrel/architecture.yml`.
- Tests use them (`tests/viewer/layout.test.ts`, `tests/viewer/navigation.test.ts`,
  `tests/core/load.test.ts`, `e2e/navigation.spec.ts`): assert on stable facts only (the
  universes, the links between them), and build dedicated fixtures for anything more precise.
- When a feature is added, show it here if it helps understanding, then update the file tree and
  the role of each file in the main README › *Organising the files*, and `examples/README.md`.
