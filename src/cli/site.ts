// What the dev server and the static build share: the precompiled viewer and the site layout
// (index.html + assets/, architecture.json, files/<project-relative path> for local icons,
// icons/ for the icons of collections, their attributions and licenses).
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Architecture } from '../core/index.ts'

export const DATA_FILE = 'architecture.json'
export const FILES_DIR = 'files'
/** Endpoint of the dev server's live-reload event stream, advertised to the viewer in a meta tag. */
export const EVENTS_PATH = '__events'
export const LIVE_META = `<meta name="graphinity:live" content="${EVENTS_PATH}">`

/** The precompiled viewer: `dist/viewer` next to `dist/cli` once built, or from the sources. */
export function viewerDir(): string {
  const candidates = [new URL('../viewer/', import.meta.url), new URL('../../dist/viewer/', import.meta.url)]
  for (const candidate of candidates) {
    const dir = fileURLToPath(candidate)
    if (existsSync(`${dir}index.html`)) return dir
  }
  throw new Error('The viewer is not built. Run "pnpm build" in the graphinity package.')
}

/** Project-relative paths of the local images used by the architecture: icons and backgrounds. */
export function localFiles(architecture: Architecture): string[] {
  const files = new Set<string>()
  for (const universe of Object.values(architecture.universes)) {
    for (const { icon } of [...universe.groups, ...universe.nodes]) if (icon?.type === 'file') files.add(icon.path)
    if (universe.background?.image !== undefined) files.add(universe.background.image)
  }
  return [...files]
}

export function summary(architecture: Architecture): string {
  const universes = Object.values(architecture.universes)
  const nodes = universes.reduce((n, u) => n + u.nodes.length, 0)
  const edges = universes.reduce((n, u) => n + u.edges.length, 0)
  return `${plural(universes.length, 'universe')}, ${plural(nodes, 'node')}, ${plural(edges, 'connection')}`
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

export function contentType(file: string): string {
  const dot = file.lastIndexOf('.')
  return CONTENT_TYPES[dot === -1 ? '' : file.slice(dot).toLowerCase()] ?? 'application/octet-stream'
}
