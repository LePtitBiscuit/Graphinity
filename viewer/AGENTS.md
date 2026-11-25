# AGENTS.md - viewer (Vue 3 + Vue Flow)

The interactive viewer, bundled by Vite into `dist/viewer` and shipped precompiled in the
package. Read the [root guide](../AGENTS.md) first.

## Files (`viewer/src/`)

| File | Role |
| ---- | ---- |
| `main.ts`, `style.css` | Entry point; theme variables (`--na-*`) and Vue Flow variable overrides (`--xy-*`). |
| `App.vue` | Fetches `architecture.json`, shows configuration errors, live reload when the dev server's meta tag is present. |
| `components/Explorer.vue` | Navigation: the path (mirrored in the URL hash), breadcrumb, back button, viewport memory (by `pathKey`), selected node. `UniverseView` is keyed by `pathKey`: the same universe opened through another node has other doors. |
| `components/UniverseView.vue` | One universe in Vue Flow: layout (cached per universe), text measuring, events (click, double-click, drag). |
| `components/ServiceNode.vue` | A node: square tile with icon and corner tags, name and description below, connection handles. |
| `components/GroupNode.vue` | A group frame with its icon and name, its fill (`--group-fill`: a color, or transparent for `none`). |
| `components/RoutedEdge.vue` | A connection: the route computed by the layout, or, once a node or group has been dragged, its route from `routing.ts`. |
| `components/NodeIcon.vue` | Simple Icons logo (path data), icon of another collection or local image (`<img>` of a site file), or generic icon. |
| `components/NodeDetails.vue` | Details panel of the selected node (below the search field). |
| `components/SearchBox.vue` | Search field (top right): an ARIA combobox (the focus stays in the field, `aria-activedescendant`), results of the universe shown first, `/` and Ctrl/⌘+K focus it, `Esc` clears it. Emits the chosen `SearchEntry`; `Explorer.vue` opens its universe (`pathTo`), selects a node and sets `LOCATED` (flow.ts): `UniverseView.vue` frames it (`fitView` on that node, without the initial fit when the universe was opened for it), `ServiceNode.vue`/`GroupNode.vue` draw the `.locator` ring (keyed by `seq`, so finding it again replays the pulse). |
| `search.ts` | Search: `searchIndex` (every node and group of the reachable universes, once per universe, with `fold`ed names), `search` (case, accents and spaces ignored; ranking; `SEARCH_LIMIT`), `pathTo` (the path that shows a universe, keeping the current one when it can). Pure, unit-tested. |
| `components/ConfigErrors.vue` | Button listing the configuration errors when the dev server shows a partial diagram (`ViewerData.errors`). |
| `context.ts` | What the ancestors say about the current universe (depends on the navigation path): doors (`Portal`) and connections declared higher up (`fromPath`/`toPath`). Pure, unit-tested. |
| `gestures.ts` | Scroll navigation: the gesture filled by the amount scrolled (`SCROLL_AMOUNT`, cancelled after `SCROLL_IDLE`), `wheelDistance`, `enterTarget` (only node with a universe, or the one under or closest to the mouse cursor), `EXIT_ZOOM` (share of the fit zoom where leaving starts), `easeOut`, `fitZoom`. Pure, unit-tested. |
| `components/PortalNode.vue` | A door: a large, translucent (frosted glass, dashed) node of another universe; clicking it goes back there. |
| `layout.ts` | ELK layout of a universe: geometry constants, ports, groups, routes. Placement hints: `place` is an ELK layer constraint (`FIRST`/`LAST`, like doors), `after` an invisible ELK edge from that node (`hiddenKey`, never returned as a route). When nodes share a layer (`beside`, `align`), `sharedLayers` computes the layers itself (per container: the universe or a group; classes of nodes kept together; ELK-like depth-first loop breaking, longest path) and gives them to ELK as positions (`INTERACTIVE` layering and cycle breaking, `LAYER_STEP`); a connection between two nodes of one class is left out of ELK (`free`) and drawn by the router only, marked `across` (no side preferred). ELK gets no labels then (they would take layers of their own): the gaps are widened for the largest label (`LABEL_ROOM`) and the router places them (`reroute(..., routerOnly)`). Universes without these hints are laid out by ELK alone, as before. Two passes when a side of a node carries several connections: the first with one port per node and side, then `spreadPorts` orders the ends of each side by the position of the node at their other end and a second pass gives each end its own port (`endKey`), spread along the tile by `portPosition(side, geometry, height, rank, count)`. ELK places the nodes; `reroute()` then draws every connection with `routeAll` (route.ts), the same router as after a drag, so the first view matches what a drag gives; ELK's route is only the fallback (loops on one node, no simple route avoiding every node), and all of ELK's routes are kept when they are less tangled (`tangle`: crossings, overlaps, turns, tiny steps, length). `groupTitle()` approximates the title of a group, kept clear of routes and labels. Pure, unit-tested. |
| `flow.ts` | Layout → Vue Flow nodes and edges (groups as parent nodes, also of inner groups; outer groups first). |
| `route.ts` | Right-angled routes. `routeAround`: the best simple route between two nodes (sides, `middles` shapes, `routeCost` with `CROSSING_COST`, `OVERLAP_COST`, `OFF_FLOW_COST` for leaving the flow's sides). `routeAll`: every connection of a universe together - sides from `routeAround`; ends spread along each side by `compareDepartures` (turning towards the start of the side, straight on, towards its end; among those turning the same way, the one turning closest to the node outside); routes drawn again against all the others (`EDGE_CROSSING_COST`, `TITLE_COST`), repeated while the order changes (`SPREAD_ROUNDS`), then `reanchor` puts the ends in the final order without changing the shapes; ELK routes kept as fallback (`kept`) take part in the spreading and lanes; nearly aligned facing ends lined up (`straighten`); segments along each other moved into lanes `LANE_GAP` apart, ordered by `compareLanes` (where each turns at both ends of the corridor; `separate`, never through a node nor turning back); labels placed off nodes, group titles and other labels (`placeLabels`). Measure with crossings and overlaps (`edgeCrossings`, `overlaps`) when tuning costs: improving one example by eye can tangle another. `shiftOf` gives an end's side and distance from the middle of that side. Pure, unit-tested. |
| `routing.ts` | After a drag: one `routeAll` for the whole canvas (a computed over Vue Flow's nodes, shared by the edges through `SHARED_ROUTES`, provided by `UniverseView.vue`), with the laid-out node sizes; undefined while nothing has moved, so the layout's routes are drawn as they are. |
| `navigation.ts` | Pure navigation functions (open, up, breadcrumb, hash). A `NavigationPath` is a list of `NavigationStep`s: a universe id and the id of the node that opened it (absent at the root), because a universe may be opened by several nodes, of one universe or of several. `linkingNode(parent, child, node?)` finds the opener (the first one when no node is given); `toHash` writes `universe~node` only for an opener that is not the first one, and `fromHash` reads both forms. `pathKey` identifies a path. Unit-tested. |
| `colors.ts` | Brand colors readable on the dark background. |

`vite.config.ts` (repository root) builds the viewer, adds the Content Security Policy to the
built page, and serves example data for `pnpm dev:viewer` (also started by `pnpm dev`): the file
in `GRAPHINITY_FILE`, on the port in `GRAPHINITY_PORT` (strict) or from 5173 upward.
`public/favicon.svg` (copied as is next to `index.html`) is generated from `brand/logo.html` by
`pnpm brand`: do not edit it.

## Rules

- **No markup injection**: never `v-html`/`innerHTML`. Brand logos are bound as SVG path data,
  local images go through `<img>` (SVG scripts never run there).
- **Nothing external**: no CDN, fonts or scripts from elsewhere; the built page has a strict CSP
  (`script-src 'self'`, no inline scripts). Inline styles are allowed (Vue Flow needs them).
- **Geometry lives in `layout.ts`**: node sizes (`nodeGeometry(size)` - box width, tile,
  tile offset and icon size of `small`/`medium`/`large` -, `TILE_TOP`, `TEXT_GAP`, `NAME_HEIGHT`,
  `DESCRIPTION_LINE_HEIGHT`, `GROUP_HEADER`) are used by ELK, by `route.ts` *and* by the
  components' CSS (through CSS variables). Change them in one place; the label and description
  fonts measured in `UniverseView.vue` must match the CSS in `style.css` and `ServiceNode.vue`.
- **Styling from the configuration** goes through CSS variables set from validated values
  (`--tile-border`, `--tile-border-style`, `--tile-bg`, `--tile-size`, `--icon-size` in
  `ServiceNode.vue`; `--group-color`, `--group-border-style` and `backdrop-filter` in
  `GroupNode.vue`) and the edge `lineStyle` in `RoutedEdge.vue`; arrowheads are Vue Flow markers
  built in `flow.ts`. The universe background is a fixed layer behind `<VueFlow>` in
  `UniverseView.vue` (`files/<path>` URL, each segment encoded). The grid button (a
  `ControlButton`) is a view-only toggle, remembered per universe for the session; the default
  is `background.grid`. `.vue-flow` and `.universe` use `overflow: clip`: they must never become
  scroll containers (focusing a control would shift the diagram).
- **Connections to groups** (`fromGroup`/`toGroup`): their ends are Vue Flow group ids
  (`groupFlowId`, `endOf` in `layout.ts`; `LaidOutEdge.from`/`to`). In ELK they attach to the
  group node itself, without ports (ELK 0.12 fails on ports of nested groups in vertical flows),
  so `reroute()` keeps ELK's routes only when they respect the configured sides of groups
  (`keepsGroupSides`). In `route.ts` a group is a `frameBox()`: a `NodeBox` with `frame: true`
  whose tile is the whole frame (`tileTop`, `tileHeight`), an end but never an obstacle nor a
  label obstacle. `GroupNode.vue` has invisible handles (Vue Flow needs them to draw edges).
  `context.ts` shows an ancestor's group as a door (`portal:<level>:group:<id>`, `Portal.group`);
  a path ending on a group (`toPathGroup`) is drawn on the node that leads to it, and in the
  universe that holds the group on its frame (`classify(..., group)`: the context edge gets
  `toGroup`); `connectionsOf` lists a group end with `group: true`.
- **Connection anchors**: a single connection on a side of a node attaches in the middle of the
  tile side; when a side carries several connections, each end gets its own ELK port, spread
  evenly along the tile (second ELK pass, `spreadPorts()`, `portPosition()`, `DEFAULT_SIDES` in
  `layout.ts`), so that ELK places the nodes with room for them. The routes drawn are those of
  `routeAll` (route.ts), which spreads the ends again along each side (`spreadEnds`), in the
  order of the direction each one leaves in. Ends with a configured `side` always use that side.
  Vue Flow handles are invisible (`HANDLE_SIDES` in `flow.ts`): edges draw their own route.
- **One universe at a time**; recursion is navigation (`Explorer.vue`), never nested rendering.
  Doors stand for nodes of the ancestors; they are layout nodes with `first`/`last` layer
  constraints (the same constraints as the node hint `place`), never the rendering of another
  universe.
- **Scroll navigation** (`UniverseView.vue` `onWheel`): enter at `MAX_ZOOM` (target from
  `enterTarget` with the cursor position of the wheel event), leave at `EXIT_ZOOM` × the fit zoom; progress is the distance
  scrolled, not time; while the bar fills the wheel event is stopped (the zoom stays) and the
  diagram is scaled towards the node (or away) and faded through the CSS `scale`/`translate`
  properties of `.vue-flow__viewport` (they compose with Vue Flow's `transform`, never set
  `transform` there); the new universe plays `arrive-in`/`arrive-out` (`arrival`, from
  `Explorer.vue`). Reduced motion turns the movements off. After a universe change the wheel
  must pause (`SCROLL_IDLE`) before a new gesture.
- **Nested groups**: ELK group nodes are created on demand, inside their parent's
  (`groupNode()` in `layout.ts`); `layout.groups` lists outer groups first (`groupDepth`), as
  Vue Flow needs parents before children. Only groups holding a node are laid out.
- **Nodes with a universe** are drawn doubled: `.nested::before` in `ServiceNode.vue`, a copy of
  the tile shifted by `BEHIND_OFFSET` (layout.ts) down and to the right; both tiles are opaque.
  The layout box does not change, but connection ends on the right side attach to the tile
  behind (`behind` in `NodeGeometry` / `NodeBox`, used by `toTile` and `route.ts`); doors are
  never doubled.
  Vue Flow parent nodes are used only for groups.
- Read-only except dragging: nodes are draggable, never connectable, deletable or editable.
- Imports from the engine: only `../../src/core/types.ts` and `errors.ts` (no Node modules).

## Tests

`tests/viewer/` (layout, flow, route, navigation, search, colors) run in Node; `e2e/navigation.spec.ts`
and `e2e/search.spec.ts` drive the built viewer through the CLI dev server in Chrome. When the drawing or an interaction changes,
update both and `docs/concepts/layout.md` / `docs/reference/viewer.md`.
