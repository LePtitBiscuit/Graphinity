import { rename, writeFile } from 'node:fs/promises'
import { request } from 'node:http'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { startDevServer, type DevServer } from '../../src/cli/dev.ts'
import { createIconifyApiProvider, createSimpleIconsProvider, type IconProvider } from '../../src/core/index.ts'
import { project, universe } from '../helpers.ts'

const json = (response: Response): Promise<any> => response.json()

const servers: DevServer[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()))
})

async function start(files: Record<string, string>, iconProviders?: IconProvider[]) {
  const viewerDir = await project({ 'index.html': '<html><head></head><body></body></html>', 'assets/app.js': 'app' })
  const dir = await project(files)
  const server = await startDevServer({
    file: path.join(dir, 'root.yml'),
    projectRoot: dir,
    viewerDir,
    port: 0,
    ...(iconProviders && { iconProviders }),
  })
  servers.push(server)
  return { server, dir, get: (pathname: string) => fetch(new URL(pathname, server.url)) }
}

/** Raw request with a chosen Host header (fetch does not allow overriding it). */
function statusWithHost(url: string, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request(url, { headers: { host } }, (res) => {
      res.resume()
      resolve(res.statusCode ?? 0)
    })
    req.on('error', reject)
    req.end()
  })
}

describe('dev server', () => {
  it('serves the viewer with live reload enabled, the data and referenced icons', async () => {
    const { get } = await start({
      'root.yml': `background: { image: img/bg.webp }\n${universe('root', '[{ id: a, name: A, icon: logo.svg }, { id: b, name: B, icon: img/photo.png }, { id: c, name: C, icon: logos:react }]')}`,
      'img/bg.webp': 'webp bytes',
      'logo.svg': '<svg/>',
      'img/photo.png': 'png bytes',
      'other.svg': '<svg/>',
    })
    const html = await (await get('/')).text()
    expect(html).toContain('<meta name="graphinity:live" content="__events">')
    expect(await (await get('/assets/app.js')).text()).toBe('app')

    const data = await get('/architecture.json')
    expect(data.status).toBe(200)
    expect((await json(data)).architecture.root).toBe('root')

    // The universe background is a referenced file too.
    expect(await (await get('/files/img/bg.webp')).text()).toBe('webp bytes')

    const icon = await get('/files/logo.svg')
    expect(icon.status).toBe(200)
    expect(icon.headers.get('content-type')).toBe('image/svg+xml')
    expect(icon.headers.get('content-security-policy')).toContain("default-src 'none'")

    // Icons of collections: generated in memory, only those used, with their attributions.
    const { icons } = await json(await get('/architecture.json'))
    const react = await get(`/${icons['logos:react'].src}`)
    expect(react.status).toBe(200)
    expect(react.headers.get('content-type')).toBe('image/svg+xml')
    expect(react.headers.get('content-security-policy')).toContain("default-src 'none'")
    expect(await react.text()).toMatch(/^<svg xmlns/)
    expect((await get('/icons/ATTRIBUTIONS.md')).status).toBe(200)
    expect((await get('/icons/0000000000000000.svg')).status).toBe(404)

    const png = await get('/files/img/photo.png')
    expect(png.status).toBe(200)
    expect(png.headers.get('content-type')).toBe('image/png')
    expect(await png.text()).toBe('png bytes')
  })

  it('serves nothing else', async () => {
    const { get, server } = await start({ 'root.yml': universe('root'), 'other.svg': '<svg/>', 'secret.txt': 'x' })
    for (const pathname of ['/files/other.svg', '/files/root.yml', '/files/../secret.txt', '/..%2f..%2fetc%2fpasswd', '/assets/%2e%2e/%2e%2e/secret.txt', '/nope.js']) {
      expect((await get(pathname)).status, pathname).toBe(404)
    }
    expect((await fetch(server.url, { method: 'POST' })).status).toBe(405)
    // DNS rebinding: only requests addressed to the local server are answered.
    expect(await statusWithHost(`${server.url}architecture.json`, 'attacker.example')).toBe(403)
    expect(await statusWithHost(`${server.url}architecture.json`, new URL(server.url).host)).toBe(200)
    // Cloudflare quick tunnels, and nothing that only looks like one.
    expect(await statusWithHost(`${server.url}architecture.json`, 'shiny-words-here.trycloudflare.com')).toBe(200)
    for (const host of ['trycloudflare.com', 'a.b.trycloudflare.com', 'evil.trycloudflare.com.attacker.example', 'eviltrycloudflare.com', 'x.trycloudflare.com:8080']) {
      expect(await statusWithHost(`${server.url}architecture.json`, host), host).toBe(403)
    }
  })

  it('reloads when a watched file changes and survives configuration errors', async () => {
    const { get, dir, server } = await start({
      'root.yml': universe('root', '[{ id: a, name: A, icon: x, universe: sub/a.yml }]'),
      'sub/a.yml': universe('a'),
    })
    const events = await get('/__events')
    const reader = events.body!.getReader()
    await reader.read() // ": connected"

    // A YAML error in a sub-universe: the rest is still served, with the error; the server keeps running.
    let reloaded = server.reloaded()
    await writeFile(path.join(dir, 'sub/a.yml'), 'id: a\nname: [broken\n')
    await reloaded
    const failing = await get('/architecture.json')
    expect(failing.status).toBe(200)
    const partial = await json(failing)
    expect(partial.errors[0]).toMatchObject({ file: 'sub/a.yml', line: 3 })
    // The root is shown; its node no longer opens the broken universe.
    expect(Object.keys(partial.architecture.universes)).toEqual(['root'])
    expect(partial.architecture.universes.root.nodes[0].universe).toBeUndefined()
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('data: reload')

    // Fixed by an editor that saves through a temporary file and a rename.
    reloaded = server.reloaded()
    await writeFile(path.join(dir, 'sub/a.tmp'), 'id: a\nname: Fixed\nnodes: []\n')
    await rename(path.join(dir, 'sub/a.tmp'), path.join(dir, 'sub/a.yml'))
    await reloaded
    const fixed = await get('/architecture.json')
    expect(fixed.status).toBe(200)
    expect((await json(fixed)).architecture.universes.a.name).toBe('Fixed')
    await reader.cancel()
  })

  it('picks up a missing sub-universe once it is created', async () => {
    const { get, dir, server } = await start({ 'root.yml': universe('root', '[{ id: a, name: A, icon: x, universe: a.yml }]') })
    const before = await json(await get('/architecture.json'))
    expect(before.errors[0].message).toMatch(/File not found/)
    const reloaded = server.reloaded()
    await writeFile(path.join(dir, 'a.yml'), universe('a'))
    await reloaded
    const after = await json(await get('/architecture.json'))
    expect(after.errors).toBeUndefined()
    expect(after.architecture.universes.root.nodes[0].universe).toBe('a')
  })

  it('resolves the new icon references of an edited file, and only those', async () => {
    const requested: string[] = []
    const api = createIconifyApiProvider({
      cacheDir: await project({}),
      offline: false,
      fetch: (async (input: string | URL | Request) => {
        const url = new URL(String(input))
        requested.push(`${url.pathname}${url.search}`)
        const prefix = url.pathname.slice(1).replace(/\.json$/, '')
        const names = url.searchParams.get('icons')?.split(',') ?? []
        const body =
          url.pathname === '/collections'
            ? { [url.searchParams.get('prefixes')!]: { name: 'Set', license: { spdx: 'MIT' } } }
            : { prefix, icons: Object.fromEntries(names.map((name) => [name, { body: `<path d="M0 0h${name.length}v1z"/>` }])), width: 24, height: 24 }
        return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
      }) as typeof fetch,
    })
    const { get, dir, server } = await start(
      { 'root.yml': universe('root', '[{ id: a, name: A, icon: mdi:database }]') },
      [createSimpleIconsProvider(), api],
    )
    const before = await json(await get('/architecture.json'))
    expect(Object.keys(before.icons)).toEqual(['mdi:database'])
    expect((await get(`/${before.icons['mdi:database'].src}`)).status).toBe(200)

    const reloaded = server.reloaded()
    await writeFile(path.join(dir, 'root.yml'), universe('root', '[{ id: a, name: A, icon: mdi:database }, { id: b, name: B, icon: lucide:network }]'))
    await reloaded
    const after = await json(await get('/architecture.json'))
    expect(Object.keys(after.icons).sort()).toEqual(['lucide:network', 'mdi:database'])
    expect((await get(`/${after.icons['lucide:network'].src}`)).status).toBe(200)
    // The icon already known is not requested again.
    expect(requested.filter((r) => !r.startsWith('/collections'))).toEqual(['/mdi.json?icons=database', '/lucide.json?icons=network'])
  })

  it('serves only the errors when the root universe cannot be shown', async () => {
    const { get } = await start({ 'root.yml': 'id: root\nname: [broken\n' })
    const response = await get('/architecture.json')
    expect(response.status).toBe(422)
    expect((await json(response)).errors[0]).toMatchObject({ file: 'root.yml' })
  })

  it('reports a busy port clearly', async () => {
    const { server } = await start({ 'root.yml': universe('root') })
    const port = Number(new URL(server.url).port)
    const viewerDir = await project({ 'index.html': '<html><head></head></html>' })
    const dir = await project({ 'root.yml': universe('root') })
    await expect(startDevServer({ file: path.join(dir, 'root.yml'), projectRoot: dir, viewerDir, port })).rejects.toThrow(
      `Port ${port} is already in use`,
    )
    // With attempts, the next free port is used.
    const next = await startDevServer({ file: path.join(dir, 'root.yml'), projectRoot: dir, viewerDir, port, portAttempts: 5 })
    servers.push(next)
    expect(Number(new URL(next.url).port)).toBeGreaterThan(port)
  })
})
