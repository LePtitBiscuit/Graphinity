import { expect, test, type Page } from '@playwright/test'

const field = (page: Page) => page.getByRole('combobox', { name: 'Search nodes and groups' })
const options = (page: Page) => page.getByRole('option')
const breadcrumb = (page: Page) => page.locator('.breadcrumb li')
const node = (page: Page, id: string) => page.locator(`.vue-flow__node[data-id="${id}"]`)
const details = (page: Page) => page.getByRole('complementary', { name: 'Node details' })

test('finds a node of a nested universe, opens it, frames and highlights the node', async ({ page }) => {
  await page.goto('/')
  await expect(node(page, 'platform')).toBeVisible()

  // `/` focuses the field; accents and case are ignored.
  await page.locator('.vue-flow__pane').click()
  await page.keyboard.press('/')
  await expect(field(page)).toBeFocused()
  await page.keyboard.type('REPLI')
  await expect(field(page)).toHaveAttribute('aria-expanded', 'true')
  const replicaB = options(page).filter({ hasText: 'Replica B' })
  await expect(replicaB).toContainText('Node')
  await expect(replicaB).toContainText('Orders database')
  // Groups are listed too, marked as such.
  await expect(options(page).filter({ has: page.locator('.name', { hasText: /^Replicas$/ }) })).toContainText('Group')

  // Arrow keys move through the results, Enter goes to the highlighted one.
  await expect(options(page).first()).toHaveAttribute('aria-selected', 'true')
  const target = (await options(page).allTextContents()).findIndex((text) => text.includes('Replica B'))
  for (let i = 0; i < target; i++) await field(page).press('ArrowDown')
  await expect(options(page).nth(target)).toHaveAttribute('aria-selected', 'true')
  await field(page).press('Enter')

  await expect(breadcrumb(page).last()).toHaveText('Orders database')
  await expect(page).toHaveURL(/#\/platform\/eu-west\/checkout\/orders-db$/)
  await expect(details(page)).toContainText('replica-b')
  await expect(node(page, 'replica-b').locator('.locator')).toHaveCount(1)
  await expect(field(page)).toHaveAttribute('aria-expanded', 'false')

  // The node is framed: its centre is near the centre of the canvas.
  await expect
    .poll(async () => {
      const box = (await node(page, 'replica-b').locator('.tile').boundingBox())!
      const size = page.viewportSize()!
      return Math.abs(box.x + box.width / 2 - size.width / 2) < 60 && Math.abs(box.y + box.height / 2 - size.height / 2) < 60
    })
    .toBe(true)

  // A click on the canvas removes the highlight; the path is kept.
  await page.locator('.vue-flow__pane').click({ position: { x: 20, y: 400 } })
  await expect(page.locator('.locator')).toHaveCount(0)
})

test('finds a group of the universe shown, says when nothing matches, and clears', async ({ page }) => {
  await page.goto('/#/platform/eu-west/checkout/orders-db')
  await field(page).click()
  await field(page).fill('patroni')
  await expect(page.getByRole('group', { name: 'This universe' }).getByRole('option')).toHaveCount(1)
  await field(page).press('Enter')
  await expect(page.locator('.vue-flow__node[data-id^="group:"] .locator')).toHaveCount(1)
  await expect(details(page)).toBeHidden()
  await expect(breadcrumb(page).last()).toHaveText('Orders database')

  await field(page).fill('no such thing here')
  await expect(page.getByText('No node or group matches "no such thing here".')).toBeVisible()

  // Escape clears the field first; the clear button too.
  await field(page).press('Escape')
  await expect(field(page)).toHaveValue('')
  await expect(field(page)).toHaveAttribute('aria-expanded', 'false')
  await field(page).fill('primary')
  await page.getByRole('button', { name: 'Clear the search' }).click()
  await expect(field(page)).toHaveValue('')
})
