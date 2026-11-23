// Every Iconify collection (https://icon-sets.iconify.design), through the official Iconify API.
// Handles any `prefix:name` reference that no other provider handles (`mdi:database`,
// `lucide:network`, `tabler:server`…). Only the icons used are downloaded - one request per
// collection -, only from the official API hosts, and only icon data (JSON), which is validated
// and turned into an SVG document here. Results are kept in a disk cache: once an icon is cached,
// no request is made for it again, and diagrams build offline. Generated sites never download
// anything.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { iconData, iconifySvg, type IconifyAlias, type IconifyIcon } from './iconify.ts'
import { cacheDirectory, DOWNLOAD_TIMEOUT_MS, limiter, MAX_CONCURRENT_DOWNLOADS, networkReason, offlineMode, RETRY_AFTER_MS } from './net.ts'
import { ANY_PREFIX, ICONIFY_NAME, type Attribution, type IconProvider, type ResolveResult } from './provider.ts'
import { svgProblem } from './svg.ts'

/** The official Iconify API hosts, tried in this order. No other host is ever contacted. */
export const ICONIFY_API_HOSTS: readonly string[] = ['https://api.iconify.design', 'https://api.simplesvg.com', 'https://api.unisvg.com']

/** Names per request (the API accepts more, but URLs stay short). */
const MAX_NAMES_PER_REQUEST = 32
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024
const MAX_BODY_LENGTH = 100_000
const MAX_DIMENSION = 10_000

export interface IconifyApiOptions {
  /** Default: `$XDG_CACHE_HOME` or `~/.cache`, `/graphinity/iconify`. */
  cacheDir?: string
  /** For tests: replaces the global `fetch`. */
  fetch?: typeof fetch
  /** Cache only, no request. Default: the `GRAPHINITY_OFFLINE` environment variable. */
  offline?: boolean
}

export function defaultIconifyCacheDir(): string {
  return cacheDirectory('iconify')
}

type Memo<T> = { value: Promise<T>; expires?: number }

export function createIconifyApiProvider(options: IconifyApiOptions = {}): IconProvider {
  const cacheDir = options.cacheDir ?? defaultIconifyCacheDir()
  const download = options.fetch ?? fetch
  const isOffline = () => options.offline ?? offlineMode()
  const limit = limiter(MAX_CONCURRENT_DOWNLOADS)
  // One resolution per icon and process: dev-server reloads reuse them. Failed downloads are
  // retried after a delay, icons that do not exist are not.
  const icons = new Map<string, Memo<ResolveResult>>()
  const collections = new Map<string, Memo<Attribution>>()

  function memoized<T>(memo: Map<string, Memo<T>>, key: string): Promise<T> | undefined {
    const entry = memo.get(key)
    if (!entry || (entry.expires !== undefined && entry.expires < Date.now())) return undefined
    return entry.value
  }

  /** GET `pathAndQuery` on the first API host that answers. */
  async function get(pathAndQuery: string): Promise<{ status: number; json?: unknown } | { error: string }> {
    let lastError = 'no API host answered'
    for (const host of ICONIFY_API_HOSTS) {
      let response: Response
      try {
        response = await limit(() =>
          download(`${host}${pathAndQuery}`, {
            signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
            redirect: 'error',
            headers: { accept: 'application/json' },
          }),
        )
      } catch (error) {
        lastError = networkReason(error)
        continue
      }
      // Overloaded or failing host: try the next one.
      if (response.status >= 500 || response.status === 429) {
        lastError = `HTTP ${response.status}`
        continue
      }
      if (response.status === 404) return { status: 404 }
      if (!response.ok) return { error: `HTTP ${response.status}` }
      if (!(response.headers.get('content-type') ?? '').includes('json')) return { error: 'unexpected response (not JSON)' }
      if (Number(response.headers.get('content-length') ?? 0) > MAX_RESPONSE_BYTES) return { error: 'response too large' }
      const text = await response.text().catch(() => undefined)
      if (text === undefined) return { error: 'download interrupted' }
      if (text.length > MAX_RESPONSE_BYTES) return { error: 'response too large' }
      try {
        return { status: 200, json: JSON.parse(text) }
      } catch {
        return { error: 'unexpected response (invalid JSON)' }
      }
    }
    return { error: `${lastError}; check your network connection` }
  }

  async function readCached(prefix: string, name: string): Promise<string | undefined> {
    try {
      const svg = await readFile(path.join(cacheDir, prefix, `${name}.svg`), 'utf8')
      return svgProblem(svg) === undefined ? svg : undefined
    } catch {
      return undefined
    }
  }

  async function writeCached(prefix: string, file: string, content: string): Promise<void> {
    try {
      await mkdir(path.join(cacheDir, prefix), { recursive: true })
      await writeFile(path.join(cacheDir, prefix, file), content)
    } catch {
      // Not cached: downloaded again next time.
    }
  }

  /** Downloads `names` (not cached) of one collection. */
  async function fetchIcons(prefix: string, names: string[]): Promise<Map<string, ResolveResult>> {
    const results = new Map<string, ResolveResult>()
    const chunks: string[][] = []
    for (let i = 0; i < names.length; i += MAX_NAMES_PER_REQUEST) chunks.push(names.slice(i, i + MAX_NAMES_PER_REQUEST))
    await Promise.all(
      chunks.map(async (chunk) => {
        const response = await get(`/${prefix}.json?icons=${chunk.join(',')}`)
        for (const name of chunk) results.set(name, await iconResult(prefix, name, response))
      }),
    )
    return results
  }

  async function iconResult(
    prefix: string,
    name: string,
    response: { status: number; json?: unknown } | { error: string },
  ): Promise<ResolveResult> {
    if ('error' in response) return { found: false, reason: `download failed (${response.error})` }
    // The API answers `404` (as JSON) for a collection it does not know.
    if (response.status === 404 || typeof response.json === 'number') {
      return { found: false, reason: `no Iconify collection is named "${prefix}" (see https://icon-sets.iconify.design)` }
    }
    const set = parseIconSet(response.json, prefix)
    if (typeof set === 'string') return { found: false, reason: `download failed (unexpected response: ${set})` }
    const icon = iconData(set, name)
    if (!icon) return { found: false, reason: 'not found' }
    const problem = iconProblem(icon)
    if (problem) return { found: false, reason: `refused: the icon data ${problem}` }
    const svg = iconifySvg(set, icon)
    const svgIssue = svgProblem(svg)
    if (svgIssue) return { found: false, reason: `refused: its SVG ${svgIssue}` }
    await writeCached(prefix, `${name}.svg`, svg)
    return { found: true, icon: { type: 'svg', title: name, svg } }
  }

  /** Credits of a collection: from the cache, else the API (`/collections`). */
  function collection(prefix: string): Promise<Attribution> {
    const known = memoized(collections, prefix)
    if (known) return known
    const value = (async (): Promise<{ attribution: Attribution; final: boolean }> => {
      const file = path.join(cacheDir, prefix, 'collection.json')
      try {
        const cached = parseCollectionInfo(JSON.parse(await readFile(file, 'utf8')), prefix)
        if (cached) return { attribution: cached, final: true }
      } catch {
        // Not cached yet.
      }
      if (!isOffline()) {
        const response = await get(`/collections?prefixes=${prefix}`)
        const raw = 'json' in response && isRecord(response.json) && Object.hasOwn(response.json, prefix) ? response.json[prefix] : undefined
        const info = parseCollectionInfo(raw, prefix)
        if (info) {
          // Cached in the API's format (only the fields used), checked again when read.
          const { collection: name, author, license, licenseUrl, source } = info
          const cached = { name, author: { name: author, url: source }, license: { spdx: license, url: licenseUrl } }
          await writeCached(prefix, 'collection.json', `${JSON.stringify(cached, null, 2)}\n`)
          return { attribution: info, final: true }
        }
      }
      return { attribution: unknownCollection(prefix), final: false }
    })()
    const entry: Memo<Attribution> = { value: value.then((v) => v.attribution) }
    collections.set(prefix, entry)
    void value.then((v) => {
      if (!v.final) entry.expires = Date.now() + RETRY_AFTER_MS
    })
    return entry.value
  }

  async function resolveMany(requested: string[], requestedPrefix: string): Promise<ResolveResult[]> {
    const prefix = requestedPrefix.toLowerCase()
    if (!ICONIFY_NAME.test(prefix)) {
      return requested.map(() => ({ found: false, reason: `"${prefix}" is not a valid Iconify collection prefix` }))
    }
    const names = requested.map((name) => name.toLowerCase())
    const pending = new Map<string, Promise<ResolveResult>>()
    /** Names resolved by this call (not memoized yet), with the function that settles them. */
    const fresh = new Map<string, (result: ResolveResult) => void>()

    for (const name of new Set(names)) {
      if (!ICONIFY_NAME.test(name)) {
        pending.set(name, Promise.resolve({ found: false, reason: 'not a valid icon name (lowercase words separated by "-")' }))
        continue
      }
      const known = memoized(icons, `${prefix}:${name}`)
      if (known) {
        pending.set(name, known)
        continue
      }
      const entry: Memo<ResolveResult> = {
        value: new Promise<ResolveResult>((resolve) => fresh.set(name, resolve)),
      }
      // Network failures and offline misses are retried later; found and missing icons are not.
      void entry.value.then((result) => {
        if (!result.found && (result.reason.startsWith('download failed') || result.reason.startsWith('not in the icon cache'))) {
          entry.expires = Date.now() + RETRY_AFTER_MS
        }
      })
      icons.set(`${prefix}:${name}`, entry)
      pending.set(name, entry.value)
    }

    // The cache first; then everything missing in one request per collection.
    const missing: string[] = []
    await Promise.all(
      [...fresh].map(async ([name, settle]) => {
        const cached = await readCached(prefix, name)
        if (cached) settle({ found: true, icon: { type: 'svg', title: name, svg: cached } })
        else if (isOffline()) settle({ found: false, reason: 'not in the icon cache, and downloads are disabled (GRAPHINITY_OFFLINE)' })
        else missing.push(name)
      }),
    )
    if (missing.length > 0) {
      // Sorted: the same icons always give the same URLs (deterministic, cache-friendly).
      missing.sort()
      const downloaded = await fetchIcons(prefix, missing)
      for (const name of missing) fresh.get(name)!(downloaded.get(name)!)
    }

    const results = await Promise.all(names.map((name) => pending.get(name)!))
    if (!results.some((result) => result.found)) return results
    const attribution = await collection(prefix)
    return results.map((result) => (result.found ? { ...result, attribution } : result))
  }

  return {
    prefix: ANY_PREFIX,
    resolveMany,
    async resolve(name, prefix) {
      if (prefix === undefined) return { found: false, reason: 'no collection prefix' }
      return (await resolveMany([name], prefix))[0]!
    },
  }
}

type IconSet = {
  icons: Record<string, IconifyIcon>
  aliases: Record<string, IconifyAlias>
  width?: number
  height?: number
  left?: number
  top?: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The API response, checked field by field; a string describes what is wrong. */
export function parseIconSet(json: unknown, prefix: string): IconSet | string {
  if (!isRecord(json)) return 'not an object'
  if (json.prefix !== prefix) return 'wrong collection'
  if (!isRecord(json.icons)) return 'no icons'
  if (json.aliases !== undefined && !isRecord(json.aliases)) return 'invalid aliases'
  const set: IconSet = { icons: Object.create(null), aliases: Object.create(null) }
  for (const key of ['width', 'height', 'left', 'top'] as const) {
    const value = json[key]
    if (value === undefined) continue
    if (!dimension(value, key === 'width' || key === 'height')) return `invalid ${key}`
    set[key] = value as number
  }
  for (const [name, icon] of Object.entries(json.icons)) {
    if (!ICONIFY_NAME.test(name) || !isRecord(icon) || typeof icon.body !== 'string') continue
    const checked = transforms(icon)
    if (checked) set.icons[name] = { ...checked, body: icon.body }
  }
  for (const [name, alias] of Object.entries(json.aliases ?? {})) {
    if (!ICONIFY_NAME.test(name) || !isRecord(alias) || typeof alias.parent !== 'string' || !ICONIFY_NAME.test(alias.parent)) continue
    const checked = transforms(alias)
    if (checked) set.aliases[name] = { ...checked, parent: alias.parent }
  }
  return set
}

function dimension(value: unknown, positive: boolean): boolean {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_DIMENSION && (!positive || value > 0)
}

/** The optional geometry of an icon or alias, if valid. */
function transforms(item: Record<string, unknown>): Omit<IconifyIcon, 'body'> | undefined {
  const out: Omit<IconifyIcon, 'body'> = {}
  for (const key of ['width', 'height', 'left', 'top'] as const) {
    if (item[key] === undefined) continue
    if (!dimension(item[key], key === 'width' || key === 'height')) return undefined
    out[key] = item[key] as number
  }
  for (const key of ['hFlip', 'vFlip'] as const) {
    if (item[key] === undefined) continue
    if (typeof item[key] !== 'boolean') return undefined
    out[key] = item[key] as boolean
  }
  if (item.rotate !== undefined) {
    if (typeof item.rotate !== 'number' || !Number.isInteger(item.rotate)) return undefined
    out.rotate = item.rotate
  }
  return out
}

/** Why the icon data cannot be used as the content of an <svg> element. */
function iconProblem(icon: IconifyIcon): string | undefined {
  if (icon.body.length > MAX_BODY_LENGTH) return 'is too large'
  if (/<\/?svg[\s>/]/i.test(icon.body)) return 'contains an <svg> element'
  if (icon.rotate || icon.hFlip || icon.vFlip) return 'uses a transformation that is not supported'
  return undefined
}

/** A single line of plain text, or undefined. */
function text(value: unknown, max = 200): string | undefined {
  if (typeof value !== 'string') return undefined
  // eslint-disable-next-line no-control-regex
  const clean = value.replace(/[\u0000-\u001f\u007f<>[\]`]/g, ' ').replace(/\s+/g, ' ').trim()
  return clean ? clean.slice(0, max) : undefined
}

function httpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 500) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined
  } catch {
    return undefined
  }
}

/** The credits of a collection, from `/collections` (or the cache). */
export function parseCollectionInfo(json: unknown, prefix: string): Attribution | undefined {
  if (!isRecord(json)) return undefined
  const name = text(json.name)
  const license = isRecord(json.license) ? json.license : {}
  const licenseId = text(license.spdx, 60) ?? text(license.title, 60)
  if (!name || !licenseId) return undefined
  const author = isRecord(json.author) ? json.author : {}
  const authorName = text(author.name)
  return {
    collection: name,
    ...(authorName && { author: authorName }),
    license: licenseId,
    licenseUrl: httpUrl(license.url) ?? `https://icon-sets.iconify.design/${prefix}/`,
    source: httpUrl(author.url) ?? `https://icon-sets.iconify.design/${prefix}/`,
  }
}

function unknownCollection(prefix: string): Attribution {
  return {
    collection: `Iconify collection "${prefix}"`,
    license: 'unknown (its details could not be downloaded)',
    licenseUrl: `https://icon-sets.iconify.design/${prefix}/`,
    source: `https://icon-sets.iconify.design/${prefix}/`,
  }
}
