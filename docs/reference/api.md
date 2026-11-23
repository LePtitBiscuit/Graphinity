# Programmatic API

The package's main entry exports the configuration engine, for scripts and tools that need the
data without the CLI. It is an **ES module** (`import`), for Node.js 22.4 or later.

```js
import { buildViewerData, formatConfigError, loadArchitecture } from 'graphinity'

const result = await loadArchitecture('architecture.yml')
if (!result.ok) {
  for (const error of result.errors) console.error(formatConfigError(error))
  process.exitCode = 1
} else {
  const { root, universes } = result.architecture
  console.log(universes[root].name, Object.keys(universes))
  const { data, files, warnings } = await buildViewerData(result.architecture)
  for (const warning of warnings) console.warn(formatConfigError(warning))
}
```

## Functions

### `loadArchitecture(rootFile, options?)`

```ts
function loadArchitecture(rootFile: string, options?: LoadOptions): Promise<LoadResult>

interface LoadOptions {
  /** Directory every referenced file must stay in. Default: the root file's directory. */
  projectRoot?: string
}
```

Loads the root universe and everything it references, validates all of it, and returns the
normalized architecture and **all** the errors. It never throws for configuration problems.

When there are errors, `architecture` still holds everything valid - each error only leaves out
the element it concerns ([details](/config/validation#when-there-are-errors)) - unless the root
universe itself cannot be read.

```ts
type LoadResult = (
  | { ok: true; architecture: Architecture; errors: [] }
  | { ok: false; errors: ConfigError[]; architecture?: Architecture }
) & {
  /** Absolute paths of the configuration and icon files read (also on failure). */
  files: string[]
}
```

`files` is what the `dev` server watches.

### `buildViewerData(architecture, options?)`

```ts
function buildViewerData(architecture: Architecture, options?: BuildViewerDataOptions): Promise<ViewerBundle>

interface BuildViewerDataOptions {
  /** Icon collections. Default: defaultIconProviders(). */
  providers?: IconProvider[]
}

interface ViewerBundle {
  /** Content of architecture.json in a built site. */
  data: ViewerData
  /** Files to write next to it: icons/<hash>.svg, icons/ATTRIBUTIONS.md, icons/licenses/… */
  files: Record<string, string>
  /** Named icons that could not be resolved (shown with the generic icon). */
  warnings: ConfigError[]
}

interface ViewerData {
  architecture: Architecture
  /** Resolved named icons, by reference ("github", "logos:react"). Unresolved ones are absent. */
  icons: Record<string, ViewerIcon>
  /** Configuration errors, set by the dev server when it shows a partial architecture. */
  errors?: ConfigError[]
}

type ViewerIcon =
  /** Simple Icons: SVG path data (24 × 24 view box) and brand color (hex without "#"). */
  | { type: 'brand'; title: string; hex: string; path: string }
  /** Other collections: an SVG file of the site, e.g. "icons/3f2a9c0d1e5b7a46.svg". */
  | { type: 'image'; title: string; src: string }
```

Resolves the named icons of the architecture (see [Icons](/config/icons)): each distinct
reference once, only the icons used. `dev` serves the result, `build` writes it. Icons of
[Iconify collections](/config/icons#any-iconify-collection) that are not bundled, and
[Dashboard Icons](/config/icons#dashboard-icons), are downloaded if they are not in the cache.

### `formatConfigError(error)`

```ts
function formatConfigError(error: ConfigError): string
```

Formats an error as the CLI prints it: `platform/clusters/eu-west.yml:55:15 nodes[2].universe: File not found: "../services/catalgo.yml"`.

## Icon providers

Each icon collection is an **icon provider**. The built-in ones are returned by
`defaultIconProviders()`; pass your own list to `buildViewerData` to replace or add collections.
A reference goes to the provider of its prefix, otherwise to the provider whose prefix is `*`
(the universal Iconify provider).

```ts
interface IconProvider {
  /** Prefix of "prefix:name" references, e.g. "logos"; "*" for every other prefix. */
  readonly prefix: string
  /** Credits, written to icons/ATTRIBUTIONS.md when the collection is used. */
  readonly attribution?: Attribution
  /** Never throws: problems are returned as { found: false, reason }. */
  resolve(name: string, prefix?: string): Promise<ResolveResult>
  /** Optional: several names of one prefix at once (one result per name, in order). */
  resolveMany?(names: string[], prefix: string): Promise<ResolveResult[]>
}

type ResolveResult =
  | {
      found: true
      icon: { type: 'brand'; title: string; hex: string; path: string } | { type: 'svg'; title: string; svg: string }
      /** Credits of this icon's collection, when they differ from the provider's. */
      attribution?: Attribution
    }
  | { found: false; reason: string }

interface Attribution {
  collection: string
  author?: string
  license: string // SPDX identifier
  licenseUrl: string
  source: string
  /** Name of a license text shipped in the package's licenses/, copied to icons/licenses/. */
  licenseFile?: string
}
```

| Export | Description |
| ------ | ----------- |
| `defaultIconProviders()` | The four bundled collections and Dashboard Icons, then the universal Iconify provider (created once per process, so their caches are shared). |
| `createSimpleIconsProvider()` | Simple Icons (`simple-icons`), from the `simple-icons` package. |
| `createIconifyProvider(prefix, attribution, load?)` | An Iconify collection; by default reads `@iconify-json/<prefix>/icons.json`. |
| `createIconifyApiProvider({ cacheDir?, fetch?, offline? })` | Every Iconify collection (prefix `*`), from the Iconify API, cached. |
| `ICONIFY_API_HOSTS` | The only hosts the Iconify provider contacts. |
| `ANY_PREFIX` | `"*"`. |
| `createDashboardIconsProvider({ cacheDir?, fetch?, offline? })` | Dashboard Icons, downloaded and cached. |
| `DASHBOARD_ICONS_REF` | The pinned commit of Dashboard Icons. |
| `ICON_COLLECTIONS` | The collections with a dedicated provider: prefixes and names. |
| `parseIconName(reference)` | `"logos:react"` → `{ prefix: "logos", name: "react" }`; no prefix → Simple Icons. |
| `svgProblem(svg)` | Why an SVG document would be refused, or `undefined`. |

SVG icons returned by any provider are [validated](/config/icons#svg-validation) before use. A
provider replaces a built-in collection (same prefix), for example to serve Dashboard Icons from
a local mirror; a provider with a new prefix takes it over from the universal Iconify provider:

```js
import { buildViewerData, defaultIconProviders, loadArchitecture } from 'graphinity'
import { readFile } from 'node:fs/promises'

const mirror = {
  prefix: 'dashboard',
  attribution: {
    collection: 'Dashboard Icons',
    license: 'Apache-2.0',
    licenseUrl: 'https://github.com/homarr-labs/dashboard-icons/blob/main/LICENSE',
    source: 'local mirror',
  },
  async resolve(name) {
    try {
      const svg = await readFile(`/srv/dashboard-icons/svg/${name}.svg`, 'utf8')
      return { found: true, icon: { type: 'svg', title: name, svg } }
    } catch {
      return { found: false, reason: 'not found' }
    }
  },
}

const result = await loadArchitecture('architecture.yml')
if (result.ok) {
  const providers = [...defaultIconProviders().filter((p) => p.prefix !== 'dashboard'), mirror]
  const { data, files, warnings } = await buildViewerData(result.architecture, { providers })
}
```

## Constants

| Export | Value |
| ------ | ----- |
| `PACKAGE_NAME` | `"graphinity"` |
| `VERSION` | the package version |
| `MAX_CONFIG_FILE_BYTES` | `1048576` (1 MB) |
| `ICON_EXTENSIONS` | `['.svg', '.png', '.webp', '.jpg', '.jpeg']` |
| `ICONS_DIR` | `"icons"`: directory of the generated icon files in a site |
| `MAX_SVG_BYTES` | `524288` (512 KB) |

## Types

All types are exported for TypeScript users (`import type { … } from 'graphinity'`).

```ts
interface Architecture {
  /** Id of the root universe. */
  root: string
  /** Every universe reachable from the root, by id, in discovery order. */
  universes: Record<string, Universe>
}

interface Universe {
  id: string
  name: string
  direction: Direction // 'right' | 'down' | 'left' | 'up'
  /** Image path relative to the project directory, color, blur in px. */
  background?: { image?: string; color?: Color; blur?: number; grid?: boolean | Color }
  /** Source file, relative to the project directory, with "/" separators. */
  source: string
  groups: ArchitectureGroup[]
  nodes: ArchitectureNode[]
  /** The "connections" of the file. */
  edges: ArchitectureEdge[]
}

interface ArchitectureNode {
  id: string
  name: string
  /** Absent when the configured icon is invalid (the viewer shows the generic icon). */
  icon?: IconRef
  description?: string
  /** Id of the universe this node opens. */
  universe?: string
  /** Id of its group. */
  group?: string
  tags?: NodeTag[]
  color?: Color // "#rrggbb" or "#rrggbbaa"
  border?: BorderStyle // 'solid' | 'dashed' | 'dotted' | 'none'
  background?: Color
  size?: NodeSize // 'small' | 'medium' | 'large'
}

interface ArchitectureGroup {
  id: string
  name: string
  icon?: IconRef
  color?: Color
  border?: BorderStyle
  blur?: number
  /** Id of the group it is inside of. */
  group?: string
  background?: Color | 'none'
}

interface ArchitectureEdge {
  /** "e0", "e1"… in file order. */
  id: string
  from: string
  to: string
  label?: string
  color?: Color
  style?: LineStyle // 'solid' | 'dashed' | 'dotted'
  arrow?: ArrowHeads // 'end' | 'start' | 'both' | 'none'
  /** Configured sides ("from: { node, side }"); absent = default side. */
  fromSide?: Side // 'left' | 'right' | 'top' | 'bottom'
  toSide?: Side
  /** End inside the sub-universe of from / to ("checkout/api" → to: "checkout", toPath: ["api"]). */
  fromPath?: string[]
  toPath?: string[]
}

type IconRef =
  | { type: 'name'; name: string }
  /** Relative to the project directory, with "/" separators. */
  | { type: 'file'; path: string }

interface NodeTag {
  text: string
  corner: Corner // 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
}

interface ConfigError {
  /** Relative to the project directory, with "/" separators. */
  file: string
  /** E.g. "nodes[2].universe"; absent for file-level errors. */
  field?: string
  message: string
  /** 1-based, when known. */
  line?: number
  column?: number
}
```

Optional properties are absent when not set (never `undefined` in the JSON).

## Not exported

The CLI commands, the dev server and the viewer are not part of the API: use the
[CLI](/cli/).
