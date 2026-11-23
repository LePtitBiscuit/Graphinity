import { expect, test } from '@playwright/test'

const port = Number(process.env.E2E_OFFLINE_PORT ?? 5198)

// A site built with Iconify icons (see offline-site.ts) is viewed with every request outside the
// local server blocked: icons are part of the site, nothing is downloaded.
test('a built site with Iconify icons works offline', async ({ page }) => {
  const external: string[] = []
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1') return route.continue()
    external.push(url.href)
    return route.abort()
  })
  await page.goto(`http://127.0.0.1:${port}/`)

  for (const id of ['db', 'server']) {
    const img = page.locator(`.vue-flow__node[data-id="${id}"] img`)
    await expect(img).toHaveAttribute('src', /^icons\/[0-9a-f]{16}\.svg$/)
    await expect.poll(() => img.evaluate((el) => (el as unknown as { complete: boolean; naturalWidth: number }).complete && (el as unknown as { naturalWidth: number }).naturalWidth > 0)).toBe(true)
  }
  // Local images: served from files/, under their project-relative paths.
  for (const [id, file] of [['team', 'icons/team.svg'], ['badge', 'icons/badge.png']]) {
    const img = page.locator(`.vue-flow__node[data-id="${id}"] img`)
    await expect(img).toHaveAttribute('src', `files/${file}`)
    await expect.poll(() => img.evaluate((el) => (el as unknown as { naturalWidth: number }).naturalWidth > 0)).toBe(true)
  }
  // Simple Icons: drawn from path data.
  await expect(page.locator('.vue-flow__node[data-id="repo"] svg path')).toHaveCount(1)
  // Credits shipped with the site.
  const credits = await (await page.request.get(`http://127.0.0.1:${port}/icons/ATTRIBUTIONS.md`)).text()
  expect(credits).toContain('Material Design Icons')
  expect(credits).toContain('Tabler Icons')
  expect(external).toEqual([])
})

test('draws the configured styles: background, group name and blur, node sizes and sides', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${port}/`)
  const wallpaper = page.locator('.wallpaper')
  await expect(wallpaper).toHaveCSS('background-image', /files\/images\/bg\.svg/)
  await expect(wallpaper).toHaveCSS('filter', 'blur(4px)')
  const group = page.locator('.vue-flow__node[data-id="group:data"] .group')
  await expect(group.locator('.name')).toHaveCSS('color', 'rgb(47, 184, 172)')
  await expect(group).toHaveCSS('backdrop-filter', 'blur(10px)')
  // A group inside a group without background: inside its frame, transparent.
  const cloud = page.locator('.vue-flow__node[data-id="group:cloud"] .group')
  await expect(cloud).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  const [outer, inner] = [(await cloud.boundingBox())!, (await group.boundingBox())!]
  expect(inner.x).toBeGreaterThan(outer.x)
  expect(inner.y).toBeGreaterThan(outer.y)
  expect(inner.x + inner.width).toBeLessThan(outer.x + outer.width)
  expect(inner.y + inner.height).toBeLessThan(outer.y + outer.height)

  const tile = (id: string) => page.locator(`.vue-flow__node[data-id="${id}"] .tile`)
  const width = async (id: string) => (await tile(id).boundingBox())!.width
  const [small, medium, large] = [await width('repo'), await width('db'), await width('server')]
  expect(small).toBeLessThan(medium)
  expect(medium).toBeLessThan(large)
  await expect(tile('server')).toHaveCSS('background-color', 'rgba(63, 185, 80, 0.15)')

  // The connection leaves the top of the server tile.
  const server = (await tile('server').boundingBox())!
  const path = page.locator('.vue-flow__edge path.vue-flow__edge-path').first()
  const start = await path.evaluate((el) => {
    const svg = el as unknown as { getPointAtLength(n: number): { x: number; y: number }; getScreenCTM(): { a: number; d: number; e: number; f: number } }
    const p = svg.getPointAtLength(0)
    const m = svg.getScreenCTM()
    return { x: p.x * m.a + m.e, y: p.y * m.d + m.f }
  })
  expect(Math.abs(start.y - server.y)).toBeLessThan(2)
  expect(Math.abs(start.x - (server.x + server.width / 2))).toBeLessThan(2)
})

test('shows or hides the grid with the controls button', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${port}/`)
  const grid = page.locator('.vue-flow__background')
  const button = page.getByRole('button', { name: /the grid$/ })
  // A universe with a background image has no grid by default.
  await expect(page.locator('.wallpaper')).toBeVisible()
  await expect(grid).toHaveCount(0)
  await expect(button).toHaveAccessibleName('Show the grid')
  const node = page.locator('.vue-flow__node[data-id="db"]')
  const before = await node.boundingBox()
  await button.click()
  await expect(grid).toHaveCount(1)
  // Toggling never moves the diagram (the canvas is not a scroll container).
  expect(await node.boundingBox()).toEqual(before)
  await expect(button).toHaveAccessibleName('Hide the grid')
  await button.click()
  await expect(grid).toHaveCount(0)
})

test('connections into a sub-universe show there, with a door back to the parent', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${port}/#/cluster`)
  const door = page.getByRole('button', { name: 'Back to Offline (Repository)' })
  await expect(door).toBeVisible()
  await expect(page.locator('.vue-flow__edge-textwrapper, .vue-flow__edge-text').filter({ hasText: 'deploy' }).first()).toBeVisible()
  // The grid of this universe has its own color.
  await expect(page.locator('.vue-flow__background-pattern').first()).toHaveCSS('stroke', 'rgba(255, 0, 0, 0.5)')
  await door.click()
  await expect(page).toHaveURL(/\/#?$/)
  await expect(page.locator('.vue-flow__node[data-id="cluster"]')).toBeVisible()
})

/** `count` wheel events of `deltaY`, 16 ms apart, on `selector`: one flick of the wheel. */
async function flick(page: import('@playwright/test').Page, selector: string, deltaY: number, count: number) {
  await page.evaluate(
    ({ selector, deltaY, count }) =>
      new Promise<void>((resolve) => {
        // Runs in the page (the e2e project is type-checked without the DOM library).
        const page = globalThis as unknown as {
          document: { querySelector(s: string): { dispatchEvent(e: unknown): void } | null }
          WheelEvent: new (type: string, init: object) => unknown
        }
        let sent = 0
        const timer = setInterval(() => {
          page.document.querySelector(selector)?.dispatchEvent(new page.WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true }))
          if (++sent >= count) {
            clearInterval(timer)
            resolve()
          }
        }, 16)
      }),
    { selector, deltaY, count },
  )
}

test('scrolling on at maximum zoom opens the universe, without pointing at the node; zooming out beyond the universe leaves it', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${port}/`)
  await expect(page.locator('.vue-flow__node[data-id="cluster"] .tile')).toBeVisible()
  // Zoom in to the maximum with the controls; the wheel is then used on the empty canvas.
  const zoomIn = page.locator('.vue-flow__controls-zoomin')
  for (let i = 0; i < 12 && (await zoomIn.isEnabled()); i++) await zoomIn.click()
  await expect(zoomIn).toBeDisabled()
  await page.waitForTimeout(600)
  // A little scrolling shows the bar (Cluster is the only node with a universe), a pause cancels it.
  await flick(page, '.vue-flow__pane', -100, 1)
  await expect(page.getByRole('status').filter({ hasText: 'Opening Cluster' })).toBeVisible()
  await page.waitForTimeout(500)
  await expect(page.getByRole('status').filter({ hasText: 'Opening Cluster' })).toHaveCount(0)
  await expect(page).not.toHaveURL(/#\/cluster/)
  // Not enough: the bar is not full yet.
  await flick(page, '.vue-flow__pane', -100, 3)
  await expect(page.getByRole('status').filter({ hasText: 'Opening Cluster' })).toBeVisible()
  await expect(page).not.toHaveURL(/#\/cluster/)
  // More opens it (enough on its own, should the pause above have reset the bar).
  await flick(page, '.vue-flow__pane', -100, 6)
  await expect(page).toHaveURL(/#\/cluster$/)

  // Out: from the fitted universe, zooming out goes on a little (no bar yet), then the bar fills.
  await page.waitForTimeout(600)
  await flick(page, '.vue-flow__pane', 100, 1)
  await expect(page.getByRole('status').filter({ hasText: 'Back to Offline' })).toHaveCount(0)
  // A few notches zoom out to the threshold, the next ones fill part of the bar.
  await flick(page, '.vue-flow__pane', 100, 7)
  await expect(page.getByRole('status').filter({ hasText: 'Back to Offline' })).toBeVisible()
  await flick(page, '.vue-flow__pane', 100, 6)
  await expect(page).not.toHaveURL(/#\/cluster/)
  await expect(page.locator('.vue-flow__node[data-id="cluster"]')).toBeVisible()
})
