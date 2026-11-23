import { expect, test, type Page } from '@playwright/test'

const breadcrumb = (page: Page) => page.locator('.breadcrumb li')
const node = (page: Page, id: string) => page.locator(`.vue-flow__node[data-id="${id}"]`)
const details = (page: Page) => page.getByRole('complementary', { name: 'Node details' })
const backButton = (page: Page) => page.getByRole('button', { name: 'Back to parent universe' })
const viewport = (page: Page) => page.locator('.vue-flow__viewport').getAttribute('style')

const ROOT = 'Kestrel Logistics'
const PLATFORM = [ROOT, 'Kestrel Platform']
const CLUSTER = [...PLATFORM, 'eu-west-1 cluster']
const CHECKOUT = [...CLUSTER, 'Checkout service']
const DATABASE = [...CHECKOUT, 'Orders database']

test('Kestrel Logistics → platform → cluster → service → database, then back to the root', async ({ page }) => {
  await page.goto('/')
  await expect(breadcrumb(page)).toHaveText([ROOT])
  await expect(backButton(page)).toBeDisabled()

  // Nodes with a sub-universe are marked; others are not.
  await expect(node(page, 'platform').locator('[data-nested]')).toHaveCount(1)
  await expect(node(page, 'stripe').locator('[data-nested]')).toHaveCount(0)
  // Drawn as a second tile behind the node (a CSS pseudo-element of the tile).
  const behind = (id: string) => node(page, id).locator('.tile').evaluate((el) => (globalThis as unknown as { getComputedStyle(e: unknown, p: string): { content: string } }).getComputedStyle(el, '::before').content)
  expect(await behind('platform')).not.toBe('none')
  expect(await behind('stripe')).toBe('none')

  // Single click: details.
  await node(page, 'platform').click()
  await expect(details(page)).toContainText('Kestrel Platform · 6 nodes')
  await expect(details(page)).toContainText('fluent-emoji-flat:eagle')

  // Double click: the sub-universe replaces the current graph.
  await node(page, 'platform').dblclick()
  await expect(breadcrumb(page)).toHaveText(PLATFORM)
  await expect(page).toHaveURL(/#\/platform$/)
  await expect(node(page, 'stripe')).toHaveCount(0)
  await expect(details(page)).toBeHidden()

  await node(page, 'eu-west').dblclick()
  await expect(breadcrumb(page)).toHaveText(CLUSTER)
  await node(page, 'checkout').dblclick()
  await expect(breadcrumb(page)).toHaveText(CHECKOUT)
  await node(page, 'db').dblclick()
  await expect(breadcrumb(page)).toHaveText(DATABASE)
  await expect(page).toHaveURL(/#\/platform\/eu-west\/checkout\/orders-db$/)
  for (const id of ['pgbouncer', 'primary', 'replica-a', 'replica-b', 'etcd', 'backup']) await expect(node(page, id)).toBeVisible()

  // Leaves have no sub-universe: double click does not navigate, details still work.
  await node(page, 'primary').dblclick()
  await expect(breadcrumb(page)).toHaveCount(5)
  await node(page, 'primary').click()
  await expect(details(page)).toContainText('postgresql (PostgreSQL)')
  await expect(details(page)).toContainText('Replica A')

  // Back button: one level up.
  await backButton(page).click()
  await expect(breadcrumb(page)).toHaveText(CHECKOUT)

  // Breadcrumb: straight to the root.
  await page.getByRole('button', { name: ROOT, exact: true }).click()
  await expect(breadcrumb(page)).toHaveText([ROOT])
  await expect(page).toHaveURL(/\/$/)
  await expect(node(page, 'platform')).toBeVisible()
})

test('reaches a shared universe from each of its parents', async ({ page }) => {
  await page.goto('/#/platform/us-east/checkout')
  await expect(breadcrumb(page)).toHaveText([...PLATFORM, 'us-east-1 cluster', 'Checkout service'])
  await expect(node(page, 'api')).toBeVisible()
  await backButton(page).click()
  await expect(breadcrumb(page)).toHaveText([...PLATFORM, 'us-east-1 cluster'])
  await expect(node(page, 'orders-replica')).toBeVisible()

  await page.goto('/?other#/platform/eu-west/checkout')
  await expect(breadcrumb(page)).toHaveText(CHECKOUT)
  await backButton(page).click()
  await expect(node(page, 'webhooks')).toBeVisible()
})

test('opens a universe shared by two nodes of one universe with the context of the node used', async ({ page }) => {
  const door = (id: string) => node(page, `portal:2:${id}`)
  await page.goto('/#/platform/eu-west')
  await expect(breadcrumb(page)).toHaveText(CLUSTER)

  // Through the canary: only its own connection comes in (ingress), the URL names the node.
  await node(page, 'checkout-canary').dblclick()
  await expect(breadcrumb(page)).toHaveText(CHECKOUT)
  await expect(page).toHaveURL(/#\/platform\/eu-west\/checkout~checkout-canary$/)
  await expect(door('ingress')).toBeVisible()
  await expect(door('storefront')).toHaveCount(0)
  await expect(node(page, 'api')).toBeVisible()

  // Back to the cluster, then in through the main checkout node: its own doors.
  await backButton(page).click()
  await expect(breadcrumb(page)).toHaveText(CLUSTER)
  await expect(page).toHaveURL(/#\/platform\/eu-west$/)
  await node(page, 'checkout').dblclick()
  await expect(page).toHaveURL(/#\/platform\/eu-west\/checkout$/)
  await expect(door('storefront')).toBeVisible()
  await expect(door('webhooks')).toBeVisible()

  // Browser history and reloads keep the entry point.
  await page.goBack()
  await expect(breadcrumb(page)).toHaveText(CLUSTER)
  await page.goBack()
  await expect(page).toHaveURL(/checkout~checkout-canary$/)
  await expect(door('storefront')).toHaveCount(0)
  await page.reload()
  await expect(door('ingress')).toBeVisible()
  await expect(door('storefront')).toHaveCount(0)
  await page.getByRole('button', { name: 'eu-west-1 cluster', exact: true }).click()
  await expect(node(page, 'checkout-canary')).toBeVisible()
})

test('fits a universe on first visit and restores its viewport afterwards', async ({ page }) => {
  await page.goto('/#/platform')
  await expect(node(page, 'eu-west')).toBeVisible()
  const fitted = await viewport(page)

  // Zoom in (zooming out of a fitted sub-universe starts leaving it instead).
  await page.mouse.move(700, 400)
  await page.mouse.wheel(0, -300)
  await expect.poll(() => viewport(page)).not.toBe(fitted)
  // Let the zoom gesture end so that the viewport is recorded.
  await page.waitForTimeout(400)
  const zoomed = await viewport(page)

  await node(page, 'eu-west').dblclick()
  await expect(breadcrumb(page)).toHaveText(CLUSTER)
  await backButton(page).click()
  await expect(node(page, 'eu-west')).toBeVisible()
  expect(await viewport(page)).toBe(zoomed)
})

test('follows browser history, deep links and fixes invalid links', async ({ page }) => {
  await page.goto('/')
  await node(page, 'platform').dblclick()
  await node(page, 'eu-west').dblclick()
  await expect(breadcrumb(page)).toHaveText(CLUSTER)

  await page.goBack()
  await expect(breadcrumb(page)).toHaveText(PLATFORM)
  await page.goForward()
  await expect(breadcrumb(page)).toHaveText(CLUSTER)

  await page.reload()
  await expect(breadcrumb(page)).toHaveText(CLUSTER)

  await page.goto('/?deep#/platform/eu-west/checkout/orders-db')
  await expect(breadcrumb(page)).toHaveText(DATABASE)

  await page.goto('/?fresh#/platform/does-not-exist')
  await expect(breadcrumb(page)).toHaveText(PLATFORM)
  await expect(page).toHaveURL(/#\/platform$/)
})

test('lets nodes be dragged, with their connections following', async ({ page }) => {
  await page.goto('/#/platform/eu-west/checkout/orders-db')
  const etcd = node(page, 'etcd')
  await expect(etcd).toBeVisible()
  // etcd is outside any group; its connection to the primary is the fifth one of the file.
  const edge = page.locator('.vue-flow__edge[data-id="e4"] path.vue-flow__edge-path')
  const before = { box: (await etcd.boundingBox())!, path: await edge.getAttribute('d') }

  await page.mouse.move(before.box.x + before.box.width / 2, before.box.y + 10)
  await page.mouse.down()
  await page.mouse.move(before.box.x + before.box.width / 2 + 100, before.box.y + 130, { steps: 8 })
  await page.mouse.up()

  // Moved along with the pointer (the drag starts after a small threshold).
  const after = (await etcd.boundingBox())!
  expect(after.x - before.box.x).toBeGreaterThan(70)
  expect(after.y - before.box.y).toBeGreaterThan(90)
  // The connection is redrawn towards the new position; a drag is not a click.
  await expect(edge).not.toHaveAttribute('d', before.path!)
  await expect(details(page)).toBeHidden()
})

test('shows nested groups, square nodes with their text below, and corner tags', async ({ page }) => {
  await page.goto('/#/platform/eu-west')
  // Four levels of groups: cluster › applications › commerce namespace › checkout node pool.
  const pool = page.locator('.vue-flow__node-cluster[data-id="group:checkout-pool"]')
  await expect(pool).toContainText('checkout · dedicated node pool')
  const frame = (await pool.boundingBox())!
  for (const id of ['checkout', 'webhooks']) {
    const box = (await node(page, id).boundingBox())!
    expect(box.x >= frame.x && box.y >= frame.y && box.x + box.width <= frame.x + frame.width).toBe(true)
  }
  for (const id of ['cluster', 'apps', 'ns-commerce']) {
    const outer = (await page.locator(`.vue-flow__node-cluster[data-id="group:${id}"]`).boundingBox())!
    expect(outer.x <= frame.x && outer.y <= frame.y && outer.x + outer.width >= frame.x + frame.width, id).toBe(true)
  }

  // Square tile; name then description below it.
  const tile = (await node(page, 'ingress').locator('.tile').boundingBox())!
  expect(Math.round(tile.width)).toBe(Math.round(tile.height))
  const name = (await node(page, 'ingress').locator('.name').boundingBox())!
  const description = (await node(page, 'ingress').locator('.description').boundingBox())!
  expect(name.y).toBeGreaterThan(tile.y + tile.height)
  expect(description.y).toBeGreaterThanOrEqual(name.y + name.height - 1)
  // Tag on the top-right corner of the tile.
  const tag = node(page, 'ingress').locator('.tag[data-corner="top-right"]')
  await expect(tag).toHaveText('3 replicas')
  const tagBox = (await tag.boundingBox())!
  expect(tagBox.x + tagBox.width / 2).toBeCloseTo(tile.x + tile.width, -1)
  expect(tagBox.y + tagBox.height / 2).toBeCloseTo(tile.y, -1)

  // Dragging a group moves its nodes along. The outermost frame (the cluster) is dragged by its
  // header: an inner group cannot leave the group it is in.
  const before = (await node(page, 'ingress').boundingBox())!
  const cluster = (await page.locator('.vue-flow__node-cluster[data-id="group:cluster"]').boundingBox())!
  await page.mouse.move(cluster.x + 40, cluster.y + 15)
  await page.mouse.down()
  await page.mouse.move(cluster.x + 240, cluster.y + 15, { steps: 8 })
  await page.mouse.up()
  expect((await node(page, 'ingress').boundingBox())!.x - before.x).toBeGreaterThan(150)
})

test('renders brand logos and bundled Iconify icons', async ({ page }) => {
  const loaded = (id: string) =>
    node(page, id)
      .locator('img.icon')
      .evaluate((img) => (img as unknown as { naturalWidth: number }).naturalWidth > 0)

  await page.goto('/')
  // Simple Icons: drawn from path data.
  await expect(node(page, 'stripe').locator('svg.icon path')).toHaveAttribute('d', /^M/)
  // SVG Logos, bundled with the package (other Iconify collections are downloaded, not in this
  // offline test: they show the generic icon here).
  await expect.poll(() => loaded('slack')).toBe(true)
  await page.goto('/#/platform/eu-west/catalog')
  await expect(node(page, 'search').locator('svg.icon path')).toHaveAttribute('d', /^M/)
})

test('closes the details with Escape or a click on the canvas', async ({ page }) => {
  await page.goto('/#/platform/eu-west/checkout/orders-db')
  await node(page, 'etcd').click()
  await expect(details(page)).toContainText('etcd')
  await page.keyboard.press('Escape')
  await expect(details(page)).toBeHidden()

  await node(page, 'etcd').click()
  await expect(details(page)).toBeVisible()
  await page.mouse.click(1200, 400) // empty canvas, right of the diagram
  await expect(details(page)).toBeHidden()
})

test('scrolling on at maximum zoom opens the universe of the node closest to the cursor', async ({ page }) => {
  await page.goto('/')
  await expect(node(page, 'platform')).toBeVisible()
  const zoomIn = page.locator('.vue-flow__controls-zoomin')
  for (let i = 0; i < 12 && (await zoomIn.isEnabled()); i++) await zoomIn.click()
  await expect(zoomIn).toBeDisabled()
  await page.waitForTimeout(600)

  // Nodes that open a universe, visible on screen; the cursor goes to the one farthest from the
  // center of the screen (the previous rule, "closest to the center", would pick another one).
  const size = page.viewportSize()!
  const visible: { id: string; x: number; y: number; distance: number }[] = []
  for (const id of ['edge', 'platform', 'data', 'warehouses', 'delivery']) {
    const box = await node(page, id).locator('.tile').boundingBox()
    if (!box || box.x < 60 || box.y < 60 || box.x + box.width > size.width - 20 || box.y + box.height > size.height - 20) continue
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    visible.push({ id, x, y, distance: Math.hypot(x - size.width / 2, y - size.height / 2) })
  }
  expect(visible.length, 'at least two universes to choose from').toBeGreaterThanOrEqual(2)
  const target = visible.sort((a, b) => b.distance - a.distance)[0]!

  await page.mouse.move(target.x, target.y)
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -100)
  await expect(page).toHaveURL(new RegExp(`#/${target.id}$`))
})
