import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildViewerData,
  createIconifyApiProvider,
  createSimpleIconsProvider,
  ICONIFY_API_HOSTS,
  type Architecture,
  type IconProvider,
} from '../../../src/core/index.ts'
import { project } from '../../helpers.ts'

interface FakeSet {
  icons: Record<string, string | Record<string, unknown>>
  aliases?: Record<string, unknown>
  width?: number
  height?: number
  info?: Record<string, unknown>
  /** Replaces the whole response body. */
  raw?: unknown
}

const DATABASE = '<path fill="currentColor" d="M12 3C7.58 3 4 4.79 4 7"/>'
const SERVER = '<path fill="none" stroke="currentColor" d="M3 7h18"/>'
const NETWORK = '<rect width="6" height="6" x="16" y="16"/>'
const DOCKER = '<path fill="#2496ed" d="M0 0h128v128H0z"/>'

const SETS: Record<string, FakeSet> = {
  mdi: {
    icons: { database: DATABASE, server: SERVER },
    aliases: { db: { parent: 'database' } },
    width: 24,
    height: 24,
    info: { name: 'Material Design Icons', author: { name: 'Pictogrammers', url: 'https://github.com/Templarian/MaterialDesign' }, license: { title: 'Apache 2.0', spdx: 'Apache-2.0', url: 'https://github.com/Templarian/MaterialDesign/blob/master/LICENSE' } },
  },
  lucide: { icons: { network: NETWORK }, width: 24, height: 24, info: { name: 'Lucide', author: { name: 'Lucide Contributors' }, license: { spdx: 'ISC' } } },
  tabler: { icons: { server: SERVER }, width: 24, height: 24, info: { name: 'Tabler Icons', license: { spdx: 'MIT' } } },
  'devicon-plain': { icons: { docker: DOCKER }, width: 128, height: 128, info: { name: 'Devicon Plain', license: { spdx: 'MIT' } } },
  gpl: { icons: { x: DATABASE }, info: { name: 'Some GPL set', license: { spdx: 'GPL-3.0', url: 'https://example.com/gpl' } } },
}

/** A fake Iconify API: `/<prefix>.json?icons=a,b` and `/collections?prefixes=p`. */
function fakeApi(sets: Record<string, FakeSet> = SETS, options: { down?: string[] } = {}) {
  let inFlight = 0
  const stats = { maxInFlight: 0 }
  const fn = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input))
    if (options.down?.includes(url.origin)) throw new TypeError('fetch failed')
    inFlight++
    stats.maxInFlight = Math.max(stats.maxInFlight, inFlight)
    await new Promise((resolve) => setTimeout(resolve, 5))
    inFlight--
    const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json; charset=utf-8' } })
    if (url.pathname === '/collections') {
      const prefix = url.searchParams.get('prefixes')!
      return json(sets[prefix]?.info ? { [prefix]: sets[prefix]!.info } : {})
    }
    const prefix = url.pathname.slice(1).replace(/\.json$/, '')
    const set = sets[prefix]
    if (!set) return json(404)
    if (set.raw !== undefined) return set.raw instanceof Response ? set.raw : json(set.raw)
    const requested = url.searchParams.get('icons')!.split(',')
    const icons: Record<string, unknown> = {}
    const aliases: Record<string, unknown> = {}
    const notFound: string[] = []
    for (const name of requested) {
      const alias = set.aliases?.[name] as { parent: string } | undefined
      if (alias) {
        aliases[name] = alias
        icons[alias.parent] = toIcon(set.icons[alias.parent]!)
      } else if (set.icons[name] !== undefined) icons[name] = toIcon(set.icons[name])
      else notFound.push(name)
    }
    return json({ prefix, icons, aliases, width: set.width, height: set.height, ...(notFound.length && { not_found: notFound }) })
  })
  return Object.assign(fn as unknown as typeof fetch & typeof fn, { stats })
}

const toIcon = (icon: string | Record<string, unknown>) => (typeof icon === 'string' ? { body: icon } : icon)

async function provider(fetcher: typeof fetch, options: { cacheDir?: string; offline?: boolean } = {}) {
  return createIconifyApiProvider({ cacheDir: options.cacheDir ?? (await project({})), fetch: fetcher, offline: options.offline ?? false })
}

function architecture(icons: string[]): Architecture {
  return {
    root: 'root',
    universes: {
      root: {
        id: 'root',
        name: 'Root',
        direction: 'right',
        source: 'root.yml',
        groups: [],
        nodes: icons.map((name, index) => ({ id: `n${index}`, name: `N${index}`, icon: { type: 'name', name } })),
        edges: [],
      },
    },
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('Iconify API provider', () => {
  it('resolves icons of several collections, generic icons and logos, with one request per collection', async () => {
    const fetch = fakeApi()
    const api = await provider(fetch)
    const mdi = await api.resolveMany!(['database', 'server', 'db'], 'mdi')
    expect(mdi.map((r) => r.found)).toEqual([true, true, true])
    expect(mdi[0]).toMatchObject({
      found: true,
      icon: {
        type: 'svg',
        title: 'database',
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" color="#e6e9ef">${DATABASE}</svg>`,
      },
      attribution: { collection: 'Material Design Icons', author: 'Pictogrammers', license: 'Apache-2.0' },
    })
    // An alias resolves to its parent icon.
    expect(mdi[2]).toMatchObject({ found: true, icon: { svg: expect.stringContaining(DATABASE) } })
    expect(await api.resolve('network', 'lucide')).toMatchObject({ found: true, attribution: { collection: 'Lucide', license: 'ISC' } })
    expect(await api.resolve('Server', 'Tabler')).toMatchObject({ found: true, icon: { title: 'server' } })
    expect(await api.resolve('docker', 'devicon-plain')).toMatchObject({ found: true, icon: { svg: expect.stringContaining('viewBox="0 0 128 128"') } })

    const urls = fetch.mock.calls.map(([url]) => String(url))
    expect(urls.filter((url) => !url.includes('/collections'))).toEqual([
      'https://api.iconify.design/mdi.json?icons=database,db,server',
      'https://api.iconify.design/lucide.json?icons=network',
      'https://api.iconify.design/tabler.json?icons=server',
      'https://api.iconify.design/devicon-plain.json?icons=docker',
    ])
    expect(urls.every((url) => ICONIFY_API_HOSTS.some((host) => url.startsWith(`${host}/`)))).toBe(true)
    // Requests never follow redirects and time out.
    expect((fetch.mock.calls[0] as unknown[])[1]).toMatchObject({ redirect: 'error', signal: expect.any(AbortSignal) })
  })

  it('reports missing icons, unknown collections and invalid references', async () => {
    const fetch = fakeApi()
    const api = await provider(fetch)
    expect(await api.resolve('nope', 'mdi')).toEqual({ found: false, reason: 'not found' })
    expect(await api.resolve('database', 'no-such-set')).toEqual({
      found: false,
      reason: 'no Iconify collection is named "no-such-set" (see https://icon-sets.iconify.design)',
    })
    const calls = fetch.mock.calls.length
    expect(await api.resolve('../etc', 'mdi')).toMatchObject({ found: false, reason: expect.stringMatching(/not a valid icon name/) })
    expect(await api.resolve('x', 'my_set')).toMatchObject({ found: false, reason: expect.stringMatching(/not a valid Iconify collection prefix/) })
    expect(await api.resolve('x')).toMatchObject({ found: false })
    expect(fetch.mock.calls.length).toBe(calls)
  })

  it('keeps icons in a disk cache: later builds make no request, also offline', async () => {
    const cacheDir = await project({})
    const fetch = fakeApi()
    const first = await provider(fetch, { cacheDir })
    await first.resolveMany!(['database', 'server'], 'mdi')
    const requests = fetch.mock.calls.length
    // Same process: from memory.
    await first.resolve('database', 'mdi')
    expect(fetch.mock.calls.length).toBe(requests)
    expect(await readFile(path.join(cacheDir, 'mdi', 'database.svg'), 'utf8')).toContain(DATABASE)
    expect(JSON.parse(await readFile(path.join(cacheDir, 'mdi', 'collection.json'), 'utf8'))).toMatchObject({ name: 'Material Design Icons' })

    // New process, no network: the cache is enough, credits included.
    const offlineFetch = fakeApi({})
    const second = await provider(offlineFetch, { cacheDir, offline: true })
    expect(await second.resolveMany!(['database', 'server'], 'mdi')).toMatchObject([
      { found: true, attribution: { collection: 'Material Design Icons' } },
      { found: true },
    ])
    expect(offlineFetch).not.toHaveBeenCalled()
    // Not cached, offline: not downloaded.
    expect(await second.resolve('network', 'lucide')).toEqual({
      found: false,
      reason: 'not in the icon cache, and downloads are disabled (GRAPHINITY_OFFLINE)',
    })
    expect(offlineFetch).not.toHaveBeenCalled()
  })

  it('ignores a cached file that is no longer a safe SVG', async () => {
    const cacheDir = await project({ 'mdi/database.svg': '<svg xmlns="http://www.w3.org/2000/svg"><script>x()</script></svg>' })
    const fetch = fakeApi()
    expect(await (await provider(fetch, { cacheDir })).resolve('database', 'mdi')).toMatchObject({ found: true, icon: { svg: expect.stringContaining(DATABASE) } })
    expect(fetch).toHaveBeenCalled()
  })

  it('tries the other official hosts, then reports the network failure and retries later', async () => {
    const fetch = fakeApi(SETS, { down: [ICONIFY_API_HOSTS[0]!] })
    expect(await (await provider(fetch)).resolve('database', 'mdi')).toMatchObject({ found: true })
    expect(String(fetch.mock.calls[1]![0])).toBe(`${ICONIFY_API_HOSTS[1]}/mdi.json?icons=database`)

    vi.useFakeTimers({ toFake: ['Date'] })
    const down = fakeApi(SETS, { down: [...ICONIFY_API_HOSTS] })
    const api = await provider(down)
    expect(await api.resolve('database', 'mdi')).toEqual({
      found: false,
      reason: 'download failed (fetch failed; check your network connection)',
    })
    expect(down).toHaveBeenCalledTimes(3)
    await api.resolve('database', 'mdi')
    expect(down).toHaveBeenCalledTimes(3)
    vi.setSystemTime(Date.now() + 60_000)
    await api.resolve('database', 'mdi')
    expect(down).toHaveBeenCalledTimes(6)
  })

  it('validates the responses of the API', async () => {
    const svgFor = async (set: FakeSet, name = 'x') => (await (await provider(fakeApi({ bad: set }))).resolve(name, 'bad'))
    expect(await svgFor({ icons: {}, raw: { prefix: 'other', icons: { x: { body: DATABASE } } } })).toMatchObject({
      found: false,
      reason: 'download failed (unexpected response: wrong collection)',
    })
    expect(await svgFor({ icons: {}, raw: new Response('<html>', { headers: { 'content-type': 'text/html' } }) })).toMatchObject({
      found: false,
      reason: 'download failed (unexpected response (not JSON))',
    })
    expect(await svgFor({ icons: {}, raw: new Response('{', { headers: { 'content-type': 'application/json' } }) })).toMatchObject({
      reason: 'download failed (unexpected response (invalid JSON))',
    })
    expect(await svgFor({ icons: { x: '<script>alert(1)</script>' } })).toEqual({ found: false, reason: 'refused: its SVG contains a script' })
    expect(await svgFor({ icons: { x: '<path/></svg><svg onload="x()">' } })).toEqual({
      found: false,
      reason: 'refused: the icon data contains an <svg> element',
    })
    expect(await svgFor({ icons: { x: '<image href="https://evil.example/x.png"/>' } })).toEqual({
      found: false,
      reason: 'refused: its SVG links to an external resource',
    })
    // Invalid geometry: the icon is ignored.
    expect(await svgFor({ icons: { x: { body: DATABASE, width: '24" onload="x()' } } })).toEqual({ found: false, reason: 'not found' })
    expect(await svgFor({ icons: { x: DATABASE }, raw: { prefix: 'bad', icons: { x: { body: DATABASE } }, width: -1 } })).toMatchObject({
      reason: 'download failed (unexpected response: invalid width)',
    })
  })

  it('limits concurrent downloads', async () => {
    const sets: Record<string, FakeSet> = {}
    for (let i = 0; i < 12; i++) sets[`set${i}`] = { icons: { x: DATABASE } }
    const fetch = fakeApi(sets)
    const api = await provider(fetch)
    const results = await Promise.all(Object.keys(sets).map((prefix) => api.resolve('x', prefix)))
    expect(results.every((r) => r.found)).toBe(true)
    expect(fetch.stats.maxInFlight).toBeLessThanOrEqual(4)
  })

  it('splits long lists of names into several requests', async () => {
    const icons = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`i${i}`, DATABASE]))
    const fetch = fakeApi({ big: { icons } })
    const results = await (await provider(fetch)).resolveMany!(Object.keys(icons), 'big')
    expect(results.every((r) => r.found)).toBe(true)
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('/big.json')).length).toBe(2)
  })
})

describe('buildViewerData with the Iconify API', () => {
  const providers = async (fetcher: typeof fetch): Promise<IconProvider[]> => [createSimpleIconsProvider(), await provider(fetcher)]

  it('writes the icons used as files, credits each collection, and keeps the dedicated providers', async () => {
    const fetch = fakeApi()
    const { data, files, warnings } = await buildViewerData(
      architecture(['mdi:database', 'lucide:network', 'tabler:server', 'mdi:db', 'github', 'mdi:nope', 'ghost:x']),
      { providers: await providers(fetch) },
    )
    expect(Object.keys(data.icons).sort()).toEqual(['github', 'lucide:network', 'mdi:database', 'mdi:db', 'tabler:server'])
    expect(data.icons['github']).toMatchObject({ type: 'brand' })
    expect(data.icons['mdi:database']).toEqual({ type: 'image', title: 'database', src: expect.stringMatching(/^icons\/[0-9a-f]{16}\.svg$/) })
    // An alias and its target share one file.
    expect(data.icons['mdi:db']).toEqual({ ...data.icons['mdi:database'], title: 'db' })
    expect(files[(data.icons['tabler:server'] as { src: string }).src]).toContain(SERVER)

    const credits = files['icons/ATTRIBUTIONS.md']!
    expect(credits).toContain('**Material Design Icons** by Pictogrammers - https://github.com/Templarian/MaterialDesign')
    expect(credits).toContain('License: Apache-2.0 (https://github.com/Templarian/MaterialDesign/blob/master/LICENSE)')
    expect(credits).toContain('**Lucide** by Lucide Contributors')
    expect(credits).toContain('**Tabler Icons**')
    expect(credits).toContain('**Simple Icons**')

    expect(warnings.map((w) => [w.field, w.message])).toEqual([
      ['nodes[5].icon', 'Icon "mdi:nope" (Iconify mdi): not found. The generic icon is shown.'],
      ['nodes[6].icon', 'Icon "ghost:x" (Iconify ghost): no Iconify collection is named "ghost" (see https://icon-sets.iconify.design). The generic icon is shown.'],
    ])
    // Dedicated providers are not asked to the API.
    expect(fetch.mock.calls.some(([url]) => String(url).includes('simple-icons'))).toBe(false)
  })

  it('warns about licenses that may restrict publishing', async () => {
    const { warnings, files } = await buildViewerData(architecture(['gpl:x']), { providers: await providers(fakeApi()) })
    expect(warnings.map((w) => w.message)).toEqual([
      'Icon collection "Some GPL set" is licensed under GPL-3.0 (https://example.com/gpl): check that its terms allow your use before publishing the site.',
    ])
    expect(files['icons/ATTRIBUTIONS.md']).toContain('**Some GPL set**')
  })

  it('sanitizes the credits downloaded for a collection', async () => {
    const sets = { odd: { icons: { x: DATABASE }, info: { name: 'Odd\n# <b>set</b>', author: { url: 'javascript:alert(1)' }, license: { spdx: 'MIT' } } } }
    const { files } = await buildViewerData(architecture(['odd:x']), { providers: await providers(fakeApi(sets)) })
    const credits = files['icons/ATTRIBUTIONS.md']!
    expect(credits).toContain('**Odd # b set /b** - https://icon-sets.iconify.design/odd/')
    expect(credits).not.toContain('javascript:')
  })
})
