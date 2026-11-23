// Iconify collections, from their official `@iconify-json/<prefix>` packages (bundled, offline).
// Only the icons used are turned into SVG documents.
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { KEBAB_NAME, type Attribution, type IconProvider } from './provider.ts'

/** The parts of the Iconify JSON format used here (https://iconify.design/docs/types/iconify-json.html). */
export interface IconifyIcon {
  body: string
  width?: number
  height?: number
  left?: number
  top?: number
  rotate?: number
  hFlip?: boolean
  vFlip?: boolean
}

export interface IconifyAlias extends Omit<IconifyIcon, 'body'> {
  parent: string
}

export interface IconifyCollection {
  prefix: string
  info?: { name?: string; author?: { name?: string; url?: string }; license?: { spdx?: string; url?: string } }
  icons: Record<string, IconifyIcon>
  aliases?: Record<string, IconifyAlias>
  width?: number
  height?: number
  left?: number
  top?: number
}

const require = createRequire(import.meta.url)

/** Loads `@iconify-json/<prefix>/icons.json`. */
async function loadPackage(prefix: string): Promise<IconifyCollection> {
  const file = require.resolve(`@iconify-json/${prefix}/icons.json`)
  return JSON.parse(await readFile(file, 'utf8')) as IconifyCollection
}

/** Icon data of `name`, following aliases (transforms are not supported: none is used by these sets). */
export function iconData(collection: Pick<IconifyCollection, 'icons' | 'aliases'>, name: string): IconifyIcon | undefined {
  let current = name
  for (let depth = 0; depth < 8; depth++) {
    if (Object.hasOwn(collection.icons, current)) return collection.icons[current]
    const alias = collection.aliases && Object.hasOwn(collection.aliases, current) ? collection.aliases[current] : undefined
    if (!alias || alias.rotate || alias.hFlip || alias.vFlip) return undefined
    current = alias.parent
  }
  return undefined
}

/** A standalone SVG document for an icon (light gray for any `currentColor` part). */
export function iconifySvg(collection: Pick<IconifyCollection, 'width' | 'height' | 'left' | 'top'>, icon: IconifyIcon): string {
  const width = icon.width ?? collection.width ?? 16
  const height = icon.height ?? collection.height ?? 16
  const left = icon.left ?? collection.left ?? 0
  const top = icon.top ?? collection.top ?? 0
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${width} ${height}" width="${width}" height="${height}" color="#e6e9ef">${icon.body}</svg>`
}

/** `load` defaults to the installed `@iconify-json/<prefix>` package. */
export function createIconifyProvider(
  prefix: string,
  attribution: Attribution,
  load: () => Promise<IconifyCollection> = () => loadPackage(prefix),
): IconProvider {
  let collection: Promise<IconifyCollection | Error> | undefined
  return {
    prefix,
    attribution,
    async resolve(reference) {
      const name = reference.toLowerCase()
      if (!KEBAB_NAME.test(name)) return { found: false, reason: 'not a valid icon name (lowercase words separated by "-")' }
      collection ??= load().catch((error: Error) => error)
      const data = await collection
      if (data instanceof Error) return { found: false, reason: `collection unavailable: ${data.message}` }
      const icon = iconData(data, name)
      if (!icon) return { found: false, reason: 'not found' }
      return { found: true, icon: { type: 'svg', title: name, svg: iconifySvg(data, icon) } }
    },
  }
}
