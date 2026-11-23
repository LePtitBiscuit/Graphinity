# AGENTS.md - src/core (configuration engine)

Loads a root YAML/JSON file and every universe it references, validates everything and returns
normalized, JSON-serializable data independent of the viewer. Exported as the package's main
entry (`graphinity`). Read the [root guide](../../AGENTS.md) first.

## Files

| File        | Role |
| ----------- | ---- |
| `index.ts`  | Public API: `loadArchitecture`, `buildViewerData`, `formatConfigError`, constants and types. Anything exported here is public: document it in `docs/reference/api.md`. |
| `types.ts`  | The normalized model (`Architecture`, `Universe`, `ArchitectureNode`, `ArchitectureGroup`, `NodeTag`, `IconRef`…) and `ConfigError`. **No Node imports**: the viewer imports it. |
| `parse.ts`  | Text → data (YAML or JSON) with positions for error reporting. Rejects YAML tags, duplicate keys, multiple documents; limits alias expansion. |
| `schema.ts` | Validation of **one** universe file: known fields only, types, lengths, ids, references inside the file (connections, groups, tags, placement hints: `checkPlacement` checks that `after` names another node of the universe and that hints form no loop; `readNode` keeps one hint per node, `place` or `after`). Returns raw values (paths unresolved) and issues with field paths. |
| `load.ts`   | Orchestration: path resolution and confinement, breadth-first discovery of sub-universes, icon resolution, unique universe ids, cycle detection, normalization. |
| `icons/`    | Icon collections. `index.ts`: `buildViewerData` (resolves each distinct named icon once, writes SVG files by content hash, warnings, attributions) and `defaultIconProviders()`. `provider.ts`: the `IconProvider` interface. `collections.ts`: prefixes with a dedicated provider. `simple-icons.ts`, `iconify.ts` (Devicon, SVG Logos, VSCode Icons from `@iconify-json/*`), `iconify-api.ts` (the universal `*` provider: every other prefix, from the official Iconify API - allowed hosts only, batched per collection, strict JSON validation, disk cache, collection credits), `dashboard.ts` (download, pinned commit, cache), `net.ts` (cache directory, `GRAPHINITY_OFFLINE`, timeout, concurrency limit). `svg.ts`: SVG validation and file names. |
| `errors.ts` | `formatConfigError`. **No Node imports** (used by the viewer). |

Pipeline: `load.ts` reads a file → `parse.ts` → `schema.ts` → resolves `icon`/`universe` paths →
queues sub-universes → after all files: unique ids, cycles → `normalize()`.

## Rules

- **Report, don't throw**: configuration problems are `ConfigError`s (`file`, `field` like
  `nodes[2].universe`, `message`, `line`/`column` from `parsed.locate`). Collect them all; a file
  with errors still has its valid nodes followed, so one run shows every error.
- **Avoid cascades**: an invalid element should produce one error, not one per reference to it
  (e.g. a node with a valid `id` stays known to connections even if another field is invalid).
- **Errors only leave out the element they concern**: always build the architecture from what is
  valid (`LoadResult.architecture`, also when `ok` is false). An invalid icon, description, tag,
  style, `size`, `background`, `blur` or placement hint (`place`, `after`: invalid value, unknown
  node, itself, a loop - reported on the first node of the loop in the file -, or both set, which
  drops `after`) is dropped from its node, group or universe (an invalid
  background image alone is dropped; its color and blur stay); an invalid connection `side` falls
  back to the default side; a connection with an unreachable path (`checkout/apii`) is dropped; a connection with any invalid drawing property is
  dropped; a node without a valid id or name is dropped (with its connections); an invalid link,
  group membership, group nesting (unknown parent, itself, cycle, more than `MAX_GROUP_DEPTH`
  levels: reported once, on that group, which goes to the top level; the groups above it are not
  reported as empty) or direction falls back to "none"/default; a universe without a valid id gets
  one from its file name. Only an unreadable root gives no architecture. Keep the table in
  `docs/config/validation.md` › *When there are errors* in sync. `validate` and `build` stay strict.
- **Untrusted input**: read only known fields; check type and length of every value; ids match
  `ID_PATTERN` (which also rules out `__proto__`); use `Object.hasOwn` and null-prototype maps.
- **File access**: every path goes through `resolveReference`/`resolveFile`: relative only, known
  extension, lexical check inside the project *before* touching the disk, then `realpath` check
  (symlinks), regular file. Never read a file outside the project.
- Messages are in English, start with a capital letter, quote the offending value, and say what
  is expected.
- Reuse the readers: `readText`, `readId`, `readChoice` (fixed values such as `border`, `style`,
  `arrow`), `readColor` (hex or `COLOR_NAMES`, normalized to lowercase `#rrggbb[aa]`). Never pass a
  raw string from a file to the viewer as a style: only validated, normalized values.

## Adding an icon collection

Any Iconify collection already works through `iconify-api.ts`: add a dedicated provider only for
a collection that is not on Iconify, or to bundle one (offline).

1. Implement `IconProvider` (`icons/provider.ts`): `resolve` never throws; return `svg` documents
   (validated by `buildViewerData`) or `brand` path data; implement `resolveMany` when one request
   can serve several names. Prefer an npm data package (offline); if you must download, use only
   fixed, allowed hosts, validate the data, cache it, use `net.ts` (timeout, concurrency limit,
   offline mode), and inject `fetch` for tests (tests run offline: `tests/setup.ts`).
2. Add its prefix to `ICON_COLLECTIONS` (`icons/collections.ts`, which also relaxes the loader's
   name syntax for it) and the provider to `defaultIconProviders()` (before the `*` provider)
   with its attribution; ship its license text in `licenses/` when its license requires it.
3. Tests in `tests/core/icons/` (found, missing, duplicates, unsafe SVG), and the documentation:
   `docs/config/icons.md` (syntax, collection, license and redistribution), and the license
   paragraph of the README if the collection is bundled.

## Adding a configuration field (checklist)

1. `types.ts`: the normalized shape (optional fields are omitted when unset, lists are `[]`).
2. `schema.ts`: add it to the `*_FIELDS` list, read and validate it, with precise messages.
3. `load.ts`: resolve paths if any (`iconRef` for icons), copy it in `normalize()`.
4. Icons: `icons/index.ts` (`buildViewerData`) and `../cli/site.ts` (`localFiles`: local images served and copied).
5. Viewer: use it (see [`viewer/AGENTS.md`](../../viewer/AGENTS.md)).
6. Tests: `tests/core/schema.test.ts` (valid and invalid values, messages), `load.test.ts`
   (normalized output, positions), layout/e2e if it changes the drawing.
7. **Documentation**: the object's page in `docs/config/` (table and example),
   `docs/config/validation.md` (rules and limits), `docs/config/index.md` (property list) - and
   the example project if it helps.

## Connections to groups

An end may be a group of the universe: a plain id names the node with that id, or the group when
no node has it; `{ group }` always names the group (`schema.ts` `readEnd`, `KnownEnds`). The raw
and normalized edges carry `fromGroup`/`toGroup`; `from`/`to` are then group ids. `checkGroupEnds`
rejects a group linked to itself or to a node or group inside it; a path cannot start at a group
and always ends on a node. Empty groups are dropped before the connections are read, so a
connection to a group that is not shown is left out without another error.

## Connections into sub-universes

An end may be a path (`checkout/api`): `schema.ts` checks its syntax and that the first node opens a
universe (`RawEdge.fromPath`/`toPath`); `load.ts` `resolveDeepEnds` follows the links once
cycles and duplicate ids have been handled, and drops (with an error) connections whose path
cannot be reached. The normalized edge keeps `from`/`to` in the declaring universe, plus
`fromPath`/`toPath`; the viewer (`viewer/src/context.ts`) draws them in the sub-universes.
