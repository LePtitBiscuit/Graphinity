// Loads a root universe and every sub-universe it references, confined to the project directory.
import { readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { parseConfig, type ConfigFormat, type FieldPath, type ParsedConfig } from './parse.ts'
import { validateUniverse, type RawGroup, type RawNode, type RawUniverse } from './schema.ts'
import { ICON_COLLECTIONS } from './icons/collections.ts'
import { MAX_SVG_BYTES, svgProblem } from './icons/svg.ts'
import type {
  Architecture,
  ArchitectureNode,
  ConfigError,
  IconRef,
  LoadResult,
  Universe,
  UniverseBackground,
} from './types.ts'

export interface LoadOptions {
  /**
   * Directory that every referenced file must stay within (symlinks included).
   * Defaults to the directory of the root file.
   */
  projectRoot?: string
}

/** Maximum size of a single configuration file. */
export const MAX_CONFIG_FILE_BYTES = 1024 * 1024

const CONFIG_EXTENSIONS: Record<string, ConfigFormat> = {
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.json': 'json',
}
/** Local icon files: displayed as images by the viewer, never inlined. */
export const ICON_EXTENSIONS = ['.svg', '.png', '.webp', '.jpg', '.jpeg']
/** `name` (Simple Icons) or `collection:name` (see icons/collections.ts); anything else must be an image path. */
const ICON_NAME_PATTERN = /^(?:([^:]*):)?([^:]*)$/
/** Names of the collections with a dedicated provider (Simple Icons slugs, Dashboard Icons names). */
const DEDICATED_NAME = /^[a-z0-9][a-z0-9._-]*$/
/** Iconify prefixes and names (https://iconify.design/docs/icons/icon-basics.html). */
const ICONIFY_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_ICON_REFERENCE = 120

interface LoadedUniverse {
  file: string
  /** The universe's id, or one derived from the file name when it has none. */
  id: string
  raw: RawUniverse
  /** What can be shown, by index in the file (see schema.ts). */
  nodes: (RawNode | undefined)[]
  groups: (RawGroup | undefined)[]
  config: ParsedConfig
  icons: IconRef[]
  groupIcons: IconRef[]
  /** Resolved sub-universe per node index (absolute real path). Rejected links are removed. */
  links: Map<number, string>
  /** Left out of the architecture (its id is already used by another file). */
  excluded?: boolean
  /** With the image resolved (project-relative). */
  background?: UniverseBackground
}

export async function loadArchitecture(
  rootFile: string,
  options: LoadOptions = {},
): Promise<LoadResult> {
  const rootPath = path.resolve(rootFile)
  const errors: ConfigError[] = []
  /** Every file read or resolved, for callers that watch them. */
  const files = new Set<string>()

  let projectRoot: string
  try {
    projectRoot = await realpath(options.projectRoot ?? path.dirname(rootPath))
  } catch {
    return {
      ok: false,
      errors: [
        { file: rootFile, message: `Project directory not found: ${options.projectRoot ?? path.dirname(rootPath)}` },
      ],
      files: [],
    }
  }

  const display = (absolute: string) => toPosix(path.relative(projectRoot, absolute))

  const root = await resolveFile(projectRoot, rootPath, Object.keys(CONFIG_EXTENSIONS))
  if ('error' in root) {
    const file = isInside(projectRoot, rootPath) ? display(rootPath) : rootFile
    return { ok: false, errors: [{ file, message: root.error }], files: [] }
  }

  // Breadth-first discovery; every file is loaded once even if referenced several times.
  const loaded = new Map<string, LoadedUniverse>()
  const queued = new Set([root.path])
  const queue = [root.path]

  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    const file = display(next)
    const fail = (message: string, field?: FieldPath, config?: ParsedConfig) =>
      errors.push(makeError(file, message, field, config))

    files.add(next)
    const config = await readConfig(next, file)
    if (Array.isArray(config)) {
      errors.push(...config)
      continue
    }

    const { universe: raw, nodes, groups, issues } = validateUniverse(config.data)
    for (const issue of issues) fail(issue.message, issue.path, config)
    // Not a universe at all (e.g. a list): nothing to show, links to it are dropped.
    if (!raw) continue

    const entry: LoadedUniverse = {
      file,
      id: raw.id ?? fallbackId(file),
      raw,
      nodes,
      groups,
      config,
      icons: [],
      groupIcons: [],
      links: new Map(),
    }
    const baseDir = path.dirname(next)

    const iconRef = async (icon: string, field: FieldPath): Promise<IconRef | undefined> => {
      const resolved = await resolveIcon(projectRoot, baseDir, icon)
      if ('error' in resolved) {
        fail(resolved.error, field, config)
        return undefined
      }
      if (resolved.path === undefined) return { type: 'name', name: icon }
      files.add(resolved.path)
      return { type: 'file', path: display(resolved.path) }
    }

    if (raw.background) {
      const { image, ...rest } = raw.background
      let resolved: string | undefined
      if (image !== undefined) {
        if (!ICON_EXTENSIONS.includes(path.extname(image).toLowerCase())) {
          fail(`"image" must be a relative path to an image file (${ICON_EXTENSIONS.join(', ')}), got "${image}"`, ['background', 'image'], config)
        } else {
          const file = await iconRef(image, ['background', 'image'])
          if (file?.type === 'file') resolved = file.path
        }
      }
      // An invalid image is left out; the color and the blur still apply.
      const background = { ...(resolved !== undefined && { image: resolved }), ...rest }
      if (Object.keys(background).length > 0) entry.background = background
    }

    for (const [index, group] of groups.entries()) {
      if (group?.icon === undefined) continue
      const icon = await iconRef(group.icon, ['groups', index, 'icon'])
      if (icon) entry.groupIcons[index] = icon
    }

    for (const [index, node] of nodes.entries()) {
      if (!node) continue
      const icon = node.icon === undefined ? undefined : await iconRef(node.icon, ['nodes', index, 'icon'])
      if (icon) entry.icons[index] = icon

      if (node.universe === undefined) continue
      const target = await resolveReference(projectRoot, baseDir, node.universe, Object.keys(CONFIG_EXTENSIONS))
      if ('error' in target) {
        fail(target.error, ['nodes', index, 'universe'], config)
        continue
      }
      entry.links.set(index, target.path)
      if (!queued.has(target.path)) {
        queued.add(target.path)
        queue.push(target.path)
      }
    }
    loaded.set(next, entry)
  }

  checkUniqueIds(loaded, errors)
  checkCycles(root.path, loaded, errors)
  resolveDeepEnds(loaded, errors)

  // Whatever is valid is shown: errors only leave out the elements they concern.
  const architecture = normalize(root.path, loaded)
  if (errors.length === 0 && architecture) return { ok: true, architecture, errors: [], files: [...files] }
  return { ok: false, errors, ...(architecture && { architecture }), files: [...files] }
}

/** `platform/clusters/eu-west.yml` → `platform-clusters-eu-west`: an id for a universe that has no valid one. */
function fallbackId(file: string): string {
  const id = file
    .replace(/\.[^./]+$/, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[^A-Za-z0-9]+/, '')
    .slice(0, 100)
  return id || 'universe'
}

async function readConfig(absolute: string, file: string): Promise<ParsedConfig | ConfigError[]> {
  let text: string
  try {
    const info = await stat(absolute)
    if (info.size > MAX_CONFIG_FILE_BYTES) {
      return [{ file, message: `File is too large (${info.size} bytes, max ${MAX_CONFIG_FILE_BYTES})` }]
    }
    text = await readFile(absolute, 'utf8')
  } catch (error) {
    return [{ file, message: `Cannot read file: ${(error as Error).message}` }]
  }

  const format = CONFIG_EXTENSIONS[path.extname(absolute).toLowerCase()] ?? 'yaml'
  const result = parseConfig(text, format)
  if (!result.ok) {
    return result.issues.map((issue) => ({ file, message: issue.message, ...positionOf(issue.position) }))
  }
  return result.config
}

/** Resolves a node icon: a plain name, or a relative path to a local SVG file. */
async function resolveIcon(
  projectRoot: string,
  baseDir: string,
  icon: string,
): Promise<{ path?: string } | { error: string }> {
  if (ICON_EXTENSIONS.includes(path.extname(icon).toLowerCase())) {
    const file = await resolveReference(projectRoot, baseDir, icon, ICON_EXTENSIONS)
    if ('error' in file || path.extname(file.path).toLowerCase() !== '.svg') return file
    // SVG files are served by the site: refuse anything that could run code or load resources.
    let svg: string
    try {
      if ((await stat(file.path)).size > MAX_SVG_BYTES) return { error: `Invalid SVG "${icon}": it is too large (max ${MAX_SVG_BYTES / 1024} KB)` }
      svg = await readFile(file.path, 'utf8')
    } catch (error) {
      return { error: `Cannot read "${icon}": ${(error as Error).message}` }
    }
    const problem = svgProblem(svg)
    return problem ? { error: `Invalid SVG "${icon}": it ${problem}` } : file
  }
  const match = icon.length <= MAX_ICON_REFERENCE ? ICON_NAME_PATTERN.exec(icon.toLowerCase()) : null
  const usage = `use an icon name ("docker", "mdi:database", "logos:react") or a relative path to an image file (${ICON_EXTENSIONS.join(', ')})`
  if (!match) return { error: `Invalid icon "${icon}": ${usage}` }
  const [, prefix, name = ''] = match
  if (prefix !== undefined && !ICONIFY_NAME.test(prefix)) {
    return { error: `Invalid icon "${icon}": "${prefix}" is not a collection prefix (lowercase letters, digits and single hyphens, e.g. "mdi", "simple-icons")` }
  }
  // Collections with a dedicated provider keep their own naming rules; any other prefix is an
  // Iconify collection, whose names are lowercase words separated by single hyphens.
  const dedicated = prefix === undefined || ICON_COLLECTIONS.some((c) => c.prefix === prefix)
  if (!(dedicated ? DEDICATED_NAME : ICONIFY_NAME).test(name)) {
    return {
      error: dedicated
        ? `Invalid icon "${icon}": ${usage}`
        : `Invalid icon "${icon}": "${name}" is not an Iconify icon name (lowercase letters, digits and single hyphens, e.g. "mdi:database")`,
    }
  }
  return {}
}

/** Resolves a relative file reference found in a configuration file. */
async function resolveReference(
  projectRoot: string,
  baseDir: string,
  reference: string,
  extensions: string[],
): Promise<{ path: string } | { error: string }> {
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(reference) || path.isAbsolute(reference) || path.win32.isAbsolute(reference)) {
    return { error: `"${reference}" must be a path relative to the current file` }
  }
  return resolveFile(projectRoot, path.resolve(baseDir, reference), extensions, reference)
}

async function resolveFile(
  projectRoot: string,
  candidate: string,
  extensions: string[],
  label: string = candidate,
): Promise<{ path: string } | { error: string }> {
  if (candidate.includes('\0')) return { error: `Invalid path "${label}"` }
  if (!extensions.includes(path.extname(candidate).toLowerCase())) {
    return { error: `Unsupported file type for "${label}" (expected ${extensions.join(', ')})` }
  }
  // Check lexically first so that nothing outside the project is even probed.
  if (!isInside(projectRoot, candidate)) {
    return { error: `"${label}" is outside the project directory` }
  }
  let real: string
  try {
    real = await realpath(candidate)
  } catch {
    return { error: `File not found: "${label}"` }
  }
  if (!isInside(projectRoot, real)) {
    return { error: `"${label}" resolves outside the project directory` }
  }
  try {
    if (!(await stat(real)).isFile()) return { error: `"${label}" is not a file` }
  } catch {
    return { error: `File not found: "${label}"` }
  }
  return { path: real }
}

/** A universe whose id is already used is left out (links to it are dropped). */
function checkUniqueIds(loaded: Map<string, LoadedUniverse>, errors: ConfigError[]): void {
  const seen = new Map<string, string>()
  for (const entry of loaded.values()) {
    const first = seen.get(entry.id)
    if (first === undefined) seen.set(entry.id, entry.file)
    else {
      errors.push(makeError(entry.file, `Universe id "${entry.id}" is already used by ${first}`, ['id'], entry.config))
      entry.excluded = true
    }
  }
}

/** Reports every reference that leads back to a universe currently being visited. */
function checkCycles(rootPath: string, loaded: Map<string, LoadedUniverse>, errors: ConfigError[]): void {
  const done = new Set<string>()
  const stack: { file: string; links: [number, string][]; next: number }[] = []
  const onStack = new Set<string>()

  const enter = (file: string) => {
    const links = [...(loaded.get(file)?.links ?? [])]
    stack.push({ file, links, next: 0 })
    onStack.add(file)
  }

  // Iterative depth-first search: nesting depth is not limited by the call stack.
  enter(rootPath)
  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!
    const link = frame.links[frame.next++]
    if (link === undefined) {
      stack.pop()
      onStack.delete(frame.file)
      done.add(frame.file)
      continue
    }
    const [index, target] = link
    if (onStack.has(target)) {
      const start = stack.findIndex((f) => f.file === target)
      const chain = [...stack.slice(start).map((f) => f.file), target]
        .map((file) => loaded.get(file)!.file)
        .join(' → ')
      const entry = loaded.get(frame.file)!
      errors.push(makeError(entry.file, `Circular universe reference: ${chain}`, ['nodes', index, 'universe'], entry.config))
      // The node is shown, without the link that closes the loop.
      entry.links.delete(index)
    } else if (!done.has(target) && loaded.has(target)) {
      enter(target)
    }
  }
}

/**
 * Checks the ends that reach into sub-universes (`checkout/api`): every step must follow a link that
 * was kept (not missing, circular or to an excluded universe), and name a node shown there; the
 * last id may name a group of the universe reached instead (`integrations/business`), marked
 * `fromPathGroup` / `toPathGroup`. A connection with an unreachable end is left out.
 */
function resolveDeepEnds(loaded: Map<string, LoadedUniverse>, errors: ConfigError[]): void {
  for (const entry of loaded.values()) {
    if (entry.excluded) continue
    entry.raw.edges = entry.raw.edges.filter((edge) => {
      for (const [key, first, inner, wanted] of [
        ['from', edge.from, edge.fromPath, edge.fromPathEnd],
        ['to', edge.to, edge.toPath, edge.toPathEnd],
      ] as const) {
        if (!inner) continue
        const { problem, group } = reach(loaded, entry, first, inner, wanted)
        if (problem) {
          const field = ['connections', edge.index, key]
          errors.push(makeError(entry.file, `${problem} ("${[first, ...inner].join('/')}")`, field, entry.config))
          return false
        }
        if (group) edge[key === 'from' ? 'fromPathGroup' : 'toPathGroup'] = true
      }
      return true
    })
  }
}

/**
 * Whether `first/inner…` can be reached from `entry` (`problem` says why not), and whether its last
 * id is a group. `wanted`: what that last id must be (absent: a node, or else a group).
 */
function reach(
  loaded: Map<string, LoadedUniverse>,
  entry: LoadedUniverse,
  first: string,
  inner: readonly string[],
  wanted: 'node' | 'group' | undefined,
): { problem?: string; group?: true } {
  let universe = entry
  let opener = first
  for (const [step, id] of inner.entries()) {
    const index = universe.nodes.findIndex((node) => node?.id === opener)
    const file = index === -1 ? undefined : universe.links.get(index)
    const next = file === undefined ? undefined : loaded.get(file)
    if (!next || next.excluded) return { problem: `The universe of "${opener}" is not available` }
    const isNode = next.nodes.some((node) => node?.id === id)
    if (step === inner.length - 1 && wanted !== 'node' && (wanted === 'group' || !isNode)) {
      // The end: a group of that universe (a shown one: with nodes and a valid name).
      if (next.groups.some((group) => group?.id === id)) return { group: true }
      return { problem: wanted === 'group' ? `Unknown group "${id}" in universe "${next.id}"` : `Unknown node or group "${id}" in universe "${next.id}"` }
    }
    if (!isNode) return { problem: `Unknown node "${id}" in universe "${next.id}"` }
    universe = next
    opener = id
  }
  return {}
}

/** The architecture made of everything valid; `undefined` when the root universe cannot be shown. */
function normalize(rootPath: string, loaded: Map<string, LoadedUniverse>): Architecture | undefined {
  const root = loaded.get(rootPath)
  if (!root || root.excluded) return undefined
  /** Universe id a link leads to, if that universe is shown. */
  const target = (file: string | undefined) => {
    const entry = file === undefined ? undefined : loaded.get(file)
    return entry && !entry.excluded ? entry.id : undefined
  }
  const universes: Record<string, Universe> = Object.create(null)
  for (const entry of loaded.values()) {
    if (entry.excluded) continue
    const { raw, icons, groupIcons, links } = entry
    const shownGroups = new Set(entry.groups.flatMap((group) => (group ? [group.id] : [])))
    const groups = entry.groups.flatMap((group, index) =>
      group
        ? [
            {
              id: group.id,
              name: group.name,
              ...(groupIcons[index] && { icon: groupIcons[index] }),
              ...(group.color !== undefined && { color: group.color }),
              ...(group.border !== undefined && { border: group.border }),
              ...(group.blur !== undefined && { blur: group.blur }),
              ...(group.group !== undefined && shownGroups.has(group.group) && { group: group.group }),
              ...(group.background !== undefined && { background: group.background }),
            },
          ]
        : [],
    )
    const groupIds = new Set(groups.map((group) => group.id))
    universes[entry.id] = {
      id: entry.id,
      name: raw.name ?? entry.id,
      direction: raw.direction,
      ...(entry.background && { background: entry.background }),
      source: entry.file,
      groups,
      nodes: entry.nodes.flatMap((node, index): ArchitectureNode[] => {
        if (!node) return []
        const opens = target(links.get(index))
        return [
          {
            id: node.id,
            name: node.name,
            ...(icons[index] && { icon: icons[index] }),
            ...(node.description !== undefined && { description: node.description }),
            ...(opens !== undefined && { universe: opens }),
            ...(node.group !== undefined && groupIds.has(node.group) && { group: node.group }),
            ...(node.tags !== undefined && { tags: node.tags }),
            ...(node.color !== undefined && { color: node.color }),
            ...(node.border !== undefined && { border: node.border }),
            ...(node.background !== undefined && { background: node.background }),
            ...(node.size !== undefined && { size: node.size }),
            ...(node.place !== undefined && { place: node.place }),
            ...(node.after !== undefined && { after: node.after }),
            ...(node.beside !== undefined && { beside: node.beside }),
          },
        ]
      }),
      edges: raw.edges.map(({ index: _, fromPathEnd: _f, toPathEnd: _t, ...edge }, index) => ({ id: `e${index}`, ...edge })),
    }
  }
  return { root: root.id, universes }
}

function makeError(
  file: string,
  message: string,
  field?: FieldPath,
  config?: ParsedConfig,
): ConfigError {
  const fieldName = field && field.length > 0 ? formatField(field) : undefined
  return {
    file,
    ...(fieldName !== undefined && { field: fieldName }),
    message,
    ...positionOf(field && config?.locate(field)),
  }
}

function positionOf(position: { line: number; column: number } | undefined) {
  return position ? { line: position.line, column: position.column } : {}
}

/** `['nodes', 2, 'universe']` → `nodes[2].universe` */
export function formatField(field: FieldPath): string {
  return field.reduce<string>(
    (out, part) => (typeof part === 'number' ? `${out}[${part}]` : out ? `${out}.${part}` : part),
    '',
  )
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate)
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
}

function toPosix(p: string): string {
  return p.split(path.sep).join('/')
}
