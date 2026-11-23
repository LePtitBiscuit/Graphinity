// Public entry point of the configuration engine (loading, validation and resolution of
// YAML/JSON universes). Independent from Vue and the CLI.
import { readFileSync } from 'node:fs'

export { formatConfigError } from './errors.ts'
export { ICON_EXTENSIONS, loadArchitecture, MAX_CONFIG_FILE_BYTES, type LoadOptions } from './load.ts'
export {
  ANY_PREFIX,
  buildViewerData,
  createDashboardIconsProvider,
  createIconifyApiProvider,
  createIconifyProvider,
  createSimpleIconsProvider,
  DASHBOARD_ICONS_REF,
  defaultIconProviders,
  ICON_COLLECTIONS,
  ICONIFY_API_HOSTS,
  ICONS_DIR,
  MAX_SVG_BYTES,
  parseIconName,
  svgProblem,
  type Attribution,
  type BuildViewerDataOptions,
  type DashboardIconsOptions,
  type IconifyApiOptions,
  type IconProvider,
  type ProvidedIcon,
  type ResolveResult,
  type ViewerBundle,
} from './icons/index.ts'
export type {
  Architecture,
  ArchitectureEdge,
  ArrowHeads,
  BorderStyle,
  Color,
  LineStyle,
  ArchitectureGroup,
  ArchitectureNode,
  BrandIcon,
  ConfigError,
  ImageIcon,
  ViewerIcon,
  Corner,
  Direction,
  IconRef,
  NodeTag,
  NodePlace,
  NodeSize,
  Side,
  UniverseBackground,
  LoadResult,
  Universe,
  ViewerData,
} from './types.ts'

interface PackageJson {
  name: string
  version: string
}

// Resolves to the package root from both src/core (dev) and dist/core (published).
const pkg = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as PackageJson

export const PACKAGE_NAME: string = pkg.name
export const VERSION: string = pkg.version
