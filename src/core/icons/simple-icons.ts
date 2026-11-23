// Simple Icons, from the `simple-icons` package (bundled, offline). Single-color logos are kept as
// path data with their brand color, so the viewer can adapt colors too dark for its background.
import type { SimpleIcon } from 'simple-icons'
import type { IconProvider } from './provider.ts'

let catalog: Promise<Map<string, SimpleIcon>> | undefined

/** Loaded lazily: the full set is large and only needed when an icon is resolved. */
function loadCatalog(): Promise<Map<string, SimpleIcon>> {
  catalog ??= import('simple-icons').then(
    (icons) => new Map(Object.values(icons).filter(isIcon).map((icon) => [icon.slug, icon])),
  )
  return catalog
}

function isIcon(value: unknown): value is SimpleIcon {
  return typeof (value as SimpleIcon | undefined)?.slug === 'string'
}

export function createSimpleIconsProvider(): IconProvider {
  return {
    prefix: 'simple-icons',
    attribution: {
      collection: 'Simple Icons',
      author: 'Simple Icons contributors',
      license: 'CC0-1.0',
      licenseUrl: 'https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md',
      source: 'https://simpleicons.org',
    },
    async resolve(name) {
      // Slugs are matched case-insensitively (e.g. "PostgreSQL").
      const icon = (await loadCatalog()).get(name.toLowerCase())
      return icon
        ? { found: true, icon: { type: 'brand', title: icon.title, hex: icon.hex, path: icon.path } }
        : { found: false, reason: 'not found' }
    },
  }
}
