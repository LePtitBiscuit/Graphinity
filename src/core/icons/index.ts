// Icon resolution for the viewer. Each named icon (`github`, `logos:react`, `mdi:database`) is
// resolved once by the provider of its collection - the bundled collections and Dashboard Icons
// have their own; every other prefix goes to the universal Iconify provider (`*`). The viewer
// only receives the icons used:
// Simple Icons as path data, everything else as SVG files of the site (one file per distinct icon).
// Local image icons are already resolved by the loader and stay as they are.
import { readFile } from 'node:fs/promises'
import type { Architecture, ConfigError, ViewerData, ViewerIcon } from '../types.ts'
import { collectionName, parseIconName } from './collections.ts'
import { createDashboardIconsProvider } from './dashboard.ts'
import { createIconifyApiProvider } from './iconify-api.ts'
import { createIconifyProvider } from './iconify.ts'
import { ANY_PREFIX, type Attribution, type IconProvider, type ResolveResult } from './provider.ts'
import { createSimpleIconsProvider } from './simple-icons.ts'
import { svgFileName, svgProblem } from './svg.ts'

export { ANY_PREFIX, type Attribution, type IconProvider, type ProvidedIcon, type ResolveResult } from './provider.ts'
export { createDashboardIconsProvider, DASHBOARD_ICONS_REF, type DashboardIconsOptions } from './dashboard.ts'
export { createIconifyApiProvider, ICONIFY_API_HOSTS, type IconifyApiOptions } from './iconify-api.ts'
export { createIconifyProvider } from './iconify.ts'
export { createSimpleIconsProvider } from './simple-icons.ts'
export { ICON_COLLECTIONS, parseIconName } from './collections.ts'
export { MAX_SVG_BYTES, svgProblem } from './svg.ts'

/** Directory of the generated icon files in a site. */
export const ICONS_DIR = 'icons'

/**
 * The built-in collections, then the universal Iconify provider for every other prefix. Created
 * once per process, so that their caches are shared (dev-server reloads reuse them).
 */
let defaults: IconProvider[] | undefined
export function defaultIconProviders(): IconProvider[] {
  defaults ??= [
    createSimpleIconsProvider(),
    createIconifyProvider('devicon', {
      collection: 'Devicon',
      author: 'konpa',
      license: 'MIT',
      licenseUrl: 'https://github.com/devicons/devicon/blob/master/LICENSE',
      source: 'https://github.com/devicons/devicon',
      licenseFile: 'devicon.txt',
    }),
    createIconifyProvider('logos', {
      collection: 'SVG Logos',
      author: 'Gil Barbara',
      license: 'CC0-1.0',
      licenseUrl: 'https://raw.githubusercontent.com/gilbarbara/logos/master/LICENSE.txt',
      source: 'https://github.com/gilbarbara/logos',
    }),
    createIconifyProvider('vscode-icons', {
      collection: 'VSCode Icons',
      author: 'Roberto Huertas',
      license: 'MIT',
      licenseUrl: 'https://github.com/vscode-icons/vscode-icons/blob/master/LICENSE',
      source: 'https://github.com/vscode-icons/vscode-icons',
      licenseFile: 'vscode-icons.txt',
    }),
    createDashboardIconsProvider(),
    createIconifyApiProvider(),
  ]
  return defaults
}

export interface ViewerBundle {
  /** Content of `architecture.json`. */
  data: ViewerData
  /** Files to write next to it (path in the site → content): icons, attributions, licenses. */
  files: Record<string, string>
  /** Icons that could not be resolved: shown with the generic icon. */
  warnings: ConfigError[]
}

export interface BuildViewerDataOptions {
  /** Default: `defaultIconProviders()`. A provider with prefix `*` handles every other prefix. */
  providers?: IconProvider[]
}

const LICENSES_DIR = new URL('../../../licenses/', import.meta.url)

/** Resolves the named icons of the architecture, for the viewer. */
export async function buildViewerData(architecture: Architecture, options: BuildViewerDataOptions = {}): Promise<ViewerBundle> {
  const providers = new Map((options.providers ?? defaultIconProviders()).map((p) => [p.prefix, p]))

  // Every distinct reference, resolved once, all in parallel.
  const uses: { reference: string; file: string; field: string }[] = []
  for (const universe of Object.values(architecture.universes)) {
    for (const [kind, items] of [['groups', universe.groups], ['nodes', universe.nodes]] as const) {
      for (const [index, { icon }] of items.entries()) {
        if (icon?.type === 'name') uses.push({ reference: icon.name, file: universe.source, field: `${kind}[${index}].icon` })
      }
    }
  }
  const references = [...new Set(uses.map((use) => use.reference))]

  // Grouped by provider and prefix: a provider with `resolveMany` gets one call per collection.
  const batches = new Map<IconProvider | undefined, Map<string, { reference: string; name: string }[]>>()
  for (const reference of references) {
    const { prefix, name } = parseIconName(reference)
    const provider = providers.get(prefix) ?? providers.get(ANY_PREFIX)
    const byPrefix = batches.get(provider) ?? new Map<string, { reference: string; name: string }[]>()
    batches.set(provider, byPrefix)
    byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), { reference, name }])
  }
  const results = new Map<string, ResolveResult & { provider?: IconProvider }>()
  await Promise.all(
    [...batches].flatMap(([provider, byPrefix]) =>
      [...byPrefix].map(async ([prefix, items]) => {
        if (!provider) {
          for (const { reference } of items) results.set(reference, { found: false, reason: `no provider handles the "${prefix}" prefix` })
          return
        }
        const resolved = provider.resolveMany
          ? await provider.resolveMany(items.map((item) => item.name), prefix)
          : await Promise.all(items.map((item) => provider.resolve(item.name, prefix)))
        items.forEach(({ reference }, index) => {
          results.set(reference, { ...(resolved[index] ?? { found: false, reason: 'not resolved' }), provider })
        })
      }),
    ),
  )

  const icons: Record<string, ViewerIcon> = Object.create(null)
  const files: Record<string, string> = Object.create(null)
  /** Collections credited, with the first reference that uses each. */
  const used = new Map<string, { attribution: Attribution; reference: string }>()
  const failures = new Map<string, string>()
  for (const reference of references) {
    const result = results.get(reference)!
    if (!result.found) {
      failures.set(reference, result.reason)
      continue
    }
    const { icon } = result
    if (icon.type === 'brand') {
      icons[reference] = icon
      continue
    }
    const problem = svgProblem(icon.svg)
    if (problem) {
      failures.set(reference, `refused: its SVG ${problem}`)
      continue
    }
    // Identical icons (e.g. an alias and its target) share one file.
    const file = `${ICONS_DIR}/${svgFileName(icon.svg)}`
    files[file] = icon.svg
    icons[reference] = { type: 'image', title: icon.title, src: file }
  }
  for (const reference of references) {
    const result = results.get(reference)!
    const attribution = result.found ? (result.attribution ?? result.provider?.attribution) : undefined
    if (attribution && !failures.has(reference) && !used.has(attribution.collection)) {
      used.set(attribution.collection, { attribution, reference })
    }
  }

  const warnings = uses.flatMap(({ reference, file, field }): ConfigError[] => {
    const reason = failures.get(reference)
    if (reason === undefined) return []
    return [{ file, field, message: `Icon "${reference}" (${collectionName(parseIconName(reference).prefix)}): ${reason}. The generic icon is shown.` }]
  })
  // Licenses that may restrict publishing: reported once per collection, on its first use.
  for (const { attribution, reference } of used.values()) {
    if (permissiveLicense(attribution.license)) continue
    const use = uses.find((u) => u.reference === reference)!
    warnings.push({
      file: use.file,
      field: use.field,
      message: `Icon collection "${attribution.collection}" is licensed under ${attribution.license} (${attribution.licenseUrl}): check that its terms allow your use before publishing the site.`,
    })
  }

  if (used.size > 0) Object.assign(files, await attributions([...used.values()].map((u) => u.attribution)))
  return { data: { architecture, icons }, files, warnings }
}

/** Licenses that allow publishing the icons in a site, with at most an attribution (given in ATTRIBUTIONS.md). */
const PERMISSIVE_LICENSES = new Set([
  'cc0-1.0',
  'mit',
  'apache-2.0',
  'isc',
  'bsd-2-clause',
  'bsd-3-clause',
  'cc-by-3.0',
  'cc-by-4.0',
  'ofl-1.1',
  'unlicense',
  'mpl-2.0',
])

function permissiveLicense(license: string): boolean {
  return PERMISSIVE_LICENSES.has(license.toLowerCase())
}

/** Credits of the collections used, with the license texts that redistribution requires. */
async function attributions(credits: Attribution[]): Promise<Record<string, string>> {
  const files: Record<string, string> = {}
  const lines = [
    '# Icon attributions',
    '',
    'This site uses icons from the following collections. Product names, logos and brands are the',
    'property of their respective owners; their use does not imply endorsement.',
    '',
  ]
  for (const credit of credits.sort((a, b) => a.collection.localeCompare(b.collection))) {
    lines.push(`- **${credit.collection}**${credit.author ? ` by ${credit.author}` : ''} - ${credit.source}`)
    lines.push(`  License: ${credit.license} (${credit.licenseUrl})`)
    if (!credit.licenseFile && credit.license.toLowerCase() !== 'cc0-1.0') {
      lines.push('  Keep this notice, and the license terms linked above, with the icons.')
    }
    if (credit.licenseFile) {
      try {
        files[`${ICONS_DIR}/licenses/${credit.licenseFile}`] = await readFile(new URL(credit.licenseFile, LICENSES_DIR), 'utf8')
        lines.push(`  Full text: licenses/${credit.licenseFile}`)
      } catch {
        // License text not shipped with this provider: the link above stands.
      }
    }
  }
  files[`${ICONS_DIR}/ATTRIBUTIONS.md`] = `${lines.join('\n')}\n`
  return files
}
