import { describe, expect, it } from 'vitest'
import {
  buildViewerData,
  createDashboardIconsProvider,
  createIconifyProvider,
  createSimpleIconsProvider,
  defaultIconProviders,
  type Architecture,
  type IconProvider,
  type IconRef,
} from '../../../src/core/index.ts'

const named = (name: string): IconRef => ({ type: 'name', name })

/** One universe with these node icons (and optional group icons). */
function architecture(nodeIcons: IconRef[], groupIcons: IconRef[] = []): Architecture {
  return {
    root: 'u',
    universes: {
      u: {
        id: 'u',
        name: 'U',
        direction: 'right',
        source: 'u.yml',
        groups: groupIcons.map((icon, i) => ({ id: `g${i}`, name: `G${i}`, icon })),
        nodes: nodeIcons.map((icon, i) => ({ id: `n${i}`, name: `N${i}`, icon })),
        edges: [],
      },
    },
  }
}

/** The built-in collections, with Dashboard Icons served by a fake (no network in tests). */
const offline = (dashboard: Record<string, string> = {}): IconProvider[] => [
  ...defaultIconProviders().filter((p) => p.prefix !== 'dashboard'),
  {
    ...createDashboardIconsProvider(),
    resolve: async (name) =>
      dashboard[name]
        ? { found: true, icon: { type: 'svg', title: name, svg: dashboard[name]! } }
        : { found: false, reason: 'not found' },
  },
]

describe('buildViewerData - collections', () => {
  it('resolves existing icons of every collection', async () => {
    const { data, files, warnings } = await buildViewerData(
      architecture([
        named('github'),
        named('simple-icons:docker'),
        named('devicon:react'),
        named('logos:vue'),
        named('vscode-icons:file-type-docker'),
        named('dashboard:jellyfin'),
      ]),
      { providers: offline({ jellyfin: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>' }) },
    )
    expect(warnings).toEqual([])
    expect(data.icons['github']).toMatchObject({ type: 'brand', title: 'GitHub', path: expect.stringMatching(/^M/) })
    expect(data.icons['simple-icons:docker']).toMatchObject({ type: 'brand', title: 'Docker' })
    for (const reference of ['devicon:react', 'logos:vue', 'vscode-icons:file-type-docker', 'dashboard:jellyfin']) {
      const icon = data.icons[reference]
      expect(icon, reference).toMatchObject({ type: 'image', src: expect.stringMatching(/^icons\/[0-9a-f]{16}\.svg$/) })
      if (icon?.type === 'image') expect(files[icon.src]).toMatch(/^<svg[\s\S]*(<\/svg>|\/>)$/)
    }
  })

  it('writes only the icons used, never whole collections', async () => {
    const { files } = await buildViewerData(architecture([named('logos:react'), named('devicon:nginx')]), { providers: offline() })
    expect(Object.keys(files).filter((f) => f.endsWith('.svg'))).toHaveLength(2)
  })

  it('builds standalone SVG documents from Iconify data', async () => {
    const { data, files } = await buildViewerData(architecture([named('logos:react')]), { providers: offline() })
    const icon = data.icons['logos:react']
    if (icon?.type !== 'image') throw new Error('expected an image')
    expect(files[icon.src]).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 256 \d+" width="256" height="\d+" color="#e6e9ef">/)
  })

  it('accepts names in any case and collection prefixes in any case', async () => {
    const { data, warnings } = await buildViewerData(architecture([named('Logos:React'), named('PostgreSQL')]), { providers: offline() })
    expect(warnings).toEqual([])
    expect(Object.keys(data.icons)).toEqual(['Logos:React', 'PostgreSQL'])
  })
})

describe('buildViewerData - missing icons', () => {
  it('warns for each use of an icon that is not found, and leaves it out', async () => {
    const { data, warnings } = await buildViewerData(
      architecture([named('not-a-brand'), named('logos:reakt'), named('logos:reakt')], [named('dashboard:nope')]),
      { providers: offline() },
    )
    expect(Object.keys(data.icons)).toEqual([])
    expect(warnings).toEqual([
      { file: 'u.yml', field: 'groups[0].icon', message: 'Icon "dashboard:nope" (Dashboard Icons): not found. The generic icon is shown.' },
      { file: 'u.yml', field: 'nodes[0].icon', message: 'Icon "not-a-brand" (Simple Icons): not found. The generic icon is shown.' },
      { file: 'u.yml', field: 'nodes[1].icon', message: 'Icon "logos:reakt" (SVG Logos): not found. The generic icon is shown.' },
      { file: 'u.yml', field: 'nodes[2].icon', message: 'Icon "logos:reakt" (SVG Logos): not found. The generic icon is shown.' },
    ])
  })

  it('warns when a collection is not available', async () => {
    const { warnings } = await buildViewerData(architecture([named('logos:react')]), { providers: [createSimpleIconsProvider()] })
    expect(warnings[0]!.message).toBe('Icon "logos:react" (SVG Logos): no provider handles the "logos" prefix. The generic icon is shown.')
    const broken = createIconifyProvider('logos', { collection: 'SVG Logos', license: 'CC0-1.0', licenseUrl: '', source: '' }, () =>
      Promise.reject(new Error('package missing')),
    )
    const second = await buildViewerData(architecture([named('logos:react')]), { providers: [broken] })
    expect(second.warnings[0]!.message).toMatch(/collection unavailable: package missing/)
  })

  it('refuses an unsafe SVG coming from a provider', async () => {
    const { data, warnings } = await buildViewerData(architecture([named('dashboard:evil')]), {
      providers: offline({ evil: '<svg xmlns="http://www.w3.org/2000/svg"><script>x()</script></svg>' }),
    })
    expect(data.icons).toEqual({})
    expect(warnings[0]!.message).toBe('Icon "dashboard:evil" (Dashboard Icons): refused: its SVG contains a script. The generic icon is shown.')
  })
})

describe('buildViewerData - duplicates and caching', () => {
  it('resolves a reference used many times once', async () => {
    let calls = 0
    const counting: IconProvider = {
      ...createDashboardIconsProvider(),
      resolve: async (name) => {
        calls++
        return { found: true, icon: { type: 'svg', title: name, svg: '<svg xmlns="http://www.w3.org/2000/svg"/>' } }
      },
    }
    const { data } = await buildViewerData(
      architecture([named('dashboard:plex'), named('dashboard:plex'), named('dashboard:plex')], [named('dashboard:plex')]),
      { providers: [counting] },
    )
    expect(calls).toBe(1)
    expect(Object.keys(data.icons)).toEqual(['dashboard:plex'])
  })

  it('writes identical icons once (an alias and its target share a file)', async () => {
    const { data, files } = await buildViewerData(architecture([named('logos:apache'), named('logos:apache-http')]), { providers: offline() })
    const [alias, target] = [data.icons['logos:apache'], data.icons['logos:apache-http']]
    expect(alias?.type === 'image' && target?.type === 'image' && alias.src === target.src).toBe(true)
    expect(Object.keys(files).filter((f) => f.endsWith('.svg'))).toHaveLength(1)
  })

  it('keeps local image icons out of the collections', async () => {
    const { data, files, warnings } = await buildViewerData(architecture([{ type: 'file', path: 'icons/own.svg' }]), { providers: offline() })
    expect(warnings).toEqual([])
    expect(data.icons).toEqual({})
    expect(files).toEqual({})
  })
})

describe('buildViewerData - attributions', () => {
  it('credits the collections used and ships the license texts redistribution requires', async () => {
    const { files } = await buildViewerData(
      architecture([named('github'), named('devicon:react'), named('logos:vue'), named('dashboard:jellyfin')]),
      { providers: offline({ jellyfin: '<svg xmlns="http://www.w3.org/2000/svg"/>' }) },
    )
    const credits = files['icons/ATTRIBUTIONS.md']!
    for (const text of ['Simple Icons', 'CC0-1.0', 'Devicon', 'MIT', 'SVG Logos', 'Dashboard Icons', 'Apache-2.0', 'property of their respective owners']) {
      expect(credits).toContain(text)
    }
    expect(credits).not.toContain('VSCode Icons')
    expect(files['icons/licenses/devicon.txt']).toMatch(/^The MIT License/)
    expect(files['icons/licenses/dashboard-icons.txt']).toMatch(/Apache License/)
    expect(files['icons/licenses/vscode-icons.txt']).toBeUndefined()
  })

  it('writes no attribution when no collection is used', async () => {
    expect((await buildViewerData(architecture([]), { providers: offline() })).files).toEqual({})
  })
})
