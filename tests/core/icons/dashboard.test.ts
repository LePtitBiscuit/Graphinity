import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createDashboardIconsProvider, DASHBOARD_ICONS_REF } from '../../../src/core/index.ts'
import { project } from '../../helpers.ts'

const JELLYFIN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#aa5cc3" d="M0 0h512v512H0z"/></svg>'

/** A fake jsDelivr: `files` by icon name, 404 otherwise. */
function fakeFetch(files: Record<string, { body: string; type?: string; status?: number }>) {
  return vi.fn(async (url: string | URL | Request) => {
    const name = String(url).match(/\/svg\/([^/]+)\.svg$/)?.[1] ?? ''
    const file = files[name]
    if (!file) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } })
    return new Response(file.body, { status: file.status ?? 200, headers: { 'content-type': file.type ?? 'image/svg+xml' } })
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>
}

describe('Dashboard Icons provider', () => {
  it('downloads an icon from the pinned repository commit, then serves it from the disk cache', async () => {
    const cacheDir = await project({})
    const fetch = fakeFetch({ jellyfin: { body: JELLYFIN } })
    const provider = createDashboardIconsProvider({ cacheDir, offline: false, fetch })

    expect(await provider.resolve('jellyfin')).toEqual({ found: true, icon: { type: 'svg', title: 'jellyfin', svg: JELLYFIN } })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(String(fetch.mock.calls[0]![0])).toBe(
      `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons@${DASHBOARD_ICONS_REF}/svg/jellyfin.svg`,
    )
    expect(await readFile(path.join(cacheDir, 'jellyfin.svg'), 'utf8')).toBe(JELLYFIN)

    // Same process: no second download. New process (new provider): the disk cache is used.
    await provider.resolve('Jellyfin')
    const offline = fakeFetch({})
    expect(await createDashboardIconsProvider({ cacheDir, offline: false, fetch: offline }).resolve('jellyfin')).toMatchObject({ found: true })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(offline).not.toHaveBeenCalled()
  })

  it('reports missing icons, network failures and unexpected content, without caching them', async () => {
    const cacheDir = await project({})
    const fetch = fakeFetch({
      html: { body: '<html></html>', type: 'text/html' },
      evil: { body: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' },
      down: { body: '', status: 503 },
    })
    const provider = createDashboardIconsProvider({ cacheDir, offline: false, fetch })
    expect(await provider.resolve('nope')).toEqual({ found: false, reason: 'not found' })
    expect(await provider.resolve('html')).toEqual({ found: false, reason: 'download failed (not an SVG file)' })
    expect(await provider.resolve('evil')).toEqual({ found: false, reason: 'refused: the downloaded SVG contains a script' })
    expect(await provider.resolve('down')).toEqual({ found: false, reason: 'download failed (HTTP 503)' })

    const failing = vi.fn(async () => {
      throw new Error('getaddrinfo ENOTFOUND cdn.jsdelivr.net')
    }) as unknown as typeof fetch
    expect(await createDashboardIconsProvider({ cacheDir, offline: false, fetch: failing }).resolve('jellyfin')).toEqual({
      found: false,
      reason: 'download failed (getaddrinfo ENOTFOUND cdn.jsdelivr.net); check your network connection',
    })
  })

  it('never builds a URL or a path from an unsafe name', async () => {
    const fetch = fakeFetch({})
    const provider = createDashboardIconsProvider({ cacheDir: await project({}), fetch })
    for (const name of ['../../etc/passwd', 'a/b', 'a b', '%2e%2e', '']) {
      expect(await provider.resolve(name)).toMatchObject({ found: false, reason: expect.stringMatching(/not a valid icon name/) })
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  it('ignores a cached file that is no longer a safe SVG', async () => {
    const cacheDir = await project({ 'jellyfin.svg': '<svg xmlns="http://www.w3.org/2000/svg" onload="x()"></svg>' })
    const fetch = fakeFetch({ jellyfin: { body: JELLYFIN } })
    expect(await createDashboardIconsProvider({ cacheDir, offline: false, fetch }).resolve('jellyfin')).toMatchObject({ found: true, icon: { svg: JELLYFIN } })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
