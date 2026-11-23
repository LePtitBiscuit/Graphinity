// Dashboard Icons (https://github.com/homarr-labs/dashboard-icons), logos of self-hosted services.
// The collection has no npm package: icons are downloaded when a diagram is built, from the
// project's own repository through jsDelivr, pinned to one commit, validated, and kept in a disk
// cache. Only SVG data is downloaded (never code); generated sites never download anything.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { cacheDirectory, DOWNLOAD_TIMEOUT_MS, limiter, MAX_CONCURRENT_DOWNLOADS, offlineMode, RETRY_AFTER_MS } from './net.ts'
import { KEBAB_NAME, type IconProvider, type ResolveResult } from './provider.ts'
import { svgProblem } from './svg.ts'

/** Commit of homarr-labs/dashboard-icons the icons are taken from (immutable on jsDelivr). */
export const DASHBOARD_ICONS_REF = 'd4b500dc40a8e1043b1581cabb7208892cf35472'
const BASE_URL = `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons@${DASHBOARD_ICONS_REF}/svg`

export interface DashboardIconsOptions {
  /** Where downloaded icons are kept. Default: `$XDG_CACHE_HOME` or `~/.cache`, `/graphinity/dashboard-icons/<ref>`. */
  cacheDir?: string
  /** For tests: replaces the global `fetch`. */
  fetch?: typeof fetch
  /** Cache only, no download. Default: the `GRAPHINITY_OFFLINE` environment variable. */
  offline?: boolean
}

export function defaultDashboardCacheDir(): string {
  return cacheDirectory('dashboard-icons', DASHBOARD_ICONS_REF)
}

export function createDashboardIconsProvider(options: DashboardIconsOptions = {}): IconProvider {
  const cacheDir = options.cacheDir ?? defaultDashboardCacheDir()
  const download = options.fetch ?? fetch
  const limit = limiter(MAX_CONCURRENT_DOWNLOADS)
  // One download per name and process: dev-server reloads reuse it. Failed downloads are retried
  // after a delay.
  const pending = new Map<string, { result: Promise<ResolveResult>; expires?: number }>()

  async function fromCache(file: string): Promise<string | undefined> {
    try {
      const svg = await readFile(file, 'utf8')
      return svgProblem(svg) === undefined ? svg : undefined
    } catch {
      return undefined
    }
  }

  async function load(name: string): Promise<ResolveResult> {
    const file = path.join(cacheDir, `${name}.svg`)
    const cached = await fromCache(file)
    if (cached) return { found: true, icon: { type: 'svg', title: name, svg: cached } }
    if (options.offline ?? offlineMode()) {
      return { found: false, reason: 'not in the icon cache, and downloads are disabled (GRAPHINITY_OFFLINE)' }
    }

    let response: Response
    try {
      response = await limit(() => download(`${BASE_URL}/${name}.svg`, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS), redirect: 'error' }))
    } catch (error) {
      return { found: false, reason: `download failed (${(error as Error).message}); check your network connection` }
    }
    if (response.status === 404) return { found: false, reason: 'not found' }
    if (!response.ok) return { found: false, reason: `download failed (HTTP ${response.status})` }
    if (!(response.headers.get('content-type') ?? '').startsWith('image/svg+xml')) {
      return { found: false, reason: 'download failed (not an SVG file)' }
    }
    const svg = await response.text()
    const problem = svgProblem(svg)
    if (problem) return { found: false, reason: `refused: the downloaded SVG ${problem}` }
    try {
      await mkdir(cacheDir, { recursive: true })
      await writeFile(file, svg)
    } catch {
      // Not cached: it will be downloaded again next time.
    }
    return { found: true, icon: { type: 'svg', title: name, svg } }
  }

  return {
    prefix: 'dashboard',
    attribution: {
      collection: 'Dashboard Icons',
      author: 'Homarr Labs',
      license: 'Apache-2.0',
      licenseUrl: `https://github.com/homarr-labs/dashboard-icons/blob/${DASHBOARD_ICONS_REF}/LICENSE`,
      source: 'https://github.com/homarr-labs/dashboard-icons',
      licenseFile: 'dashboard-icons.txt',
    },
    resolve(reference) {
      const name = reference.toLowerCase()
      // The name ends up in a URL and a file path: lowercase words and hyphens only.
      if (!KEBAB_NAME.test(name)) {
        return Promise.resolve({ found: false, reason: 'not a valid icon name (lowercase words separated by "-")' })
      }
      const known = pending.get(name)
      if (known && (known.expires === undefined || known.expires >= Date.now())) return known.result
      const entry: { result: Promise<ResolveResult>; expires?: number } = { result: load(name) }
      void entry.result.then((result) => {
        if (!result.found && result.reason !== 'not found') entry.expires = Date.now() + RETRY_AFTER_MS
      })
      pending.set(name, entry)
      return entry.result
    },
  }
}
