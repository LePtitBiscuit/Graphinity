import { realpath, symlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { formatConfigError, loadArchitecture, MAX_CONFIG_FILE_BYTES } from '../../src/core/index.ts'
import { errorsOf, project, universe } from '../helpers.ts'

const example = fileURLToPath(new URL('../../examples/kestrel/architecture.yml', import.meta.url))

describe('loadArchitecture - Kestrel Logistics example', () => {
  // The example may have errors while it is being edited: only its valid part is checked.
  it('resolves the five levels: organisation → platform → cluster → service → database', async () => {
    const result = await loadArchitecture(example)
    if (!result.architecture) throw new Error(result.errors.map(formatConfigError).join('\n'))
    const { root, universes } = result.architecture

    expect(root).toBe('kestrel')
    expect(universes['kestrel']!.source).toBe('architecture.yml')
    expect(universes['kestrel']!.nodes.find((n) => n.id === 'platform')).toMatchObject({
      universe: 'platform',
      icon: { type: 'name', name: 'fluent-emoji-flat:eagle' },
    })
    expect(universes['platform']!.source).toBe('platform/platform.yml')
    expect(universes['platform']!.nodes.find((n) => n.id === 'eu-west')?.universe).toBe('eu-west')
    expect(universes['eu-west']!.source).toBe('platform/clusters/eu-west.yml')
    expect(universes['eu-west']!.nodes.find((n) => n.id === 'checkout')?.universe).toBe('checkout')
    expect(universes['checkout']!.source).toBe('platform/services/checkout.yml')
    // A file in another folder (paths are relative to the file that contains them).
    expect(universes['checkout']!.nodes.find((n) => n.id === 'db')?.universe).toBe('orders-db')
    expect(universes['orders-db']!.source).toBe('data/orders-db.yml')
  })

  it('shares one universe between the nodes that open the same file', async () => {
    const { architecture } = await loadArchitecture(example)
    if (!architecture) throw new Error('example failed to load')
    const { universes } = architecture
    expect(universes['eu-west']!.nodes.find((n) => n.id === 'checkout')?.universe).toBe('checkout')
    expect(universes['us-east']!.nodes.find((n) => n.id === 'checkout')?.universe).toBe('checkout')
    expect(Object.values(universes).filter((u) => u.source === 'platform/services/checkout.yml')).toHaveLength(1)
  })

  it('mixes YAML and JSON files, and resolves a background image', async () => {
    const { architecture } = await loadArchitecture(example)
    if (!architecture) throw new Error('example failed to load')
    expect(architecture.universes['kafka']!.source).toBe('data/kafka.json')
    expect(architecture.universes['lyon-hub']!.background).toMatchObject({ image: 'images/floor-plan.svg' })
  })

  it('returns JSON-serializable data', async () => {
    const { architecture } = await loadArchitecture(example)
    expect(architecture).toBeDefined()
    expect(JSON.parse(JSON.stringify(architecture))).toEqual(architecture)
  })
})

describe('loadArchitecture - resolution', () => {
  it('mixes JSON and YAML and resolves paths relative to each file', async () => {
    const dir = await project({
      'root.json': JSON.stringify({
        id: 'root',
        name: 'Root',
        nodes: [{ id: 'a', name: 'A', icon: 'docker', universe: 'sub/a.yaml' }],
        connections: [],
      }),
      'sub/a.yaml': universe('a', '[{ id: b, name: B, icon: x, universe: ../deep/b.yml }]'),
      'deep/b.yml': universe('b'),
    })
    const result = await loadArchitecture(path.join(dir, 'root.json'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.values(result.architecture.universes).map((u) => u.source)).toEqual([
      'root.json',
      'sub/a.yaml',
      'deep/b.yml',
    ])
  })

  it('loads a shared sub-universe once (not a cycle)', async () => {
    const dir = await project({
      'root.yml': universe(
        'root',
        '[{ id: a, name: A, icon: x, universe: a.yml }, { id: b, name: B, icon: x, universe: b.yml }]',
      ),
      'a.yml': universe('a', '[{ id: s, name: S, icon: x, universe: shared.yml }]'),
      'b.yml': universe('b', '[{ id: s, name: S, icon: x, universe: ./shared.yml }]'),
      'shared.yml': universe('shared'),
    })
    const result = await loadArchitecture(path.join(dir, 'root.yml'))
    expect(result.ok).toBe(true)
    if (result.ok) expect(Object.keys(result.architecture.universes)).toEqual(['root', 'a', 'b', 'shared'])
  })

  it('imposes no maximum nesting depth', async () => {
    const depth = 300
    const files: Record<string, string> = {}
    for (let i = 0; i < depth; i++) {
      const child = i + 1 < depth ? `[{ id: n, name: N, icon: x, universe: u${i + 1}.yml }]` : '[]'
      files[`u${i}.yml`] = universe(`u${i}`, child)
    }
    const dir = await project(files)
    const result = await loadArchitecture(path.join(dir, 'u0.yml'))
    expect(result.ok).toBe(true)
    if (result.ok) expect(Object.keys(result.architecture.universes)).toHaveLength(depth)
  })

  it('accepts an empty universe and omits edges', async () => {
    const dir = await project({ 'root.yml': 'id: empty\nname: Empty\nnodes: []\n' })
    const result = await loadArchitecture(path.join(dir, 'root.yml'))
    expect(result).toMatchObject({
      ok: true,
      architecture: { root: 'empty', universes: { empty: { id: 'empty', name: 'Empty', source: 'root.yml', nodes: [], edges: [] } } },
    })
  })

  it('lists every file read, also when loading fails', async () => {
    const dir = await project({
      'root.yml': universe('root', '[{ id: a, name: A, icon: logo.svg, universe: sub/a.yml }]'),
      'logo.svg': '<svg/>',
      'sub/a.yml': 'id: a\nname: [broken\n',
    })
    const result = await loadArchitecture(path.join(dir, 'root.yml'))
    expect(result.ok).toBe(false)
    const real = await realpath(dir)
    expect(result.files.map((f) => path.relative(real, f)).sort()).toEqual(['logo.svg', 'root.yml', path.join('sub', 'a.yml')])
  })
})

describe('loadArchitecture - errors', () => {
  it('reports a missing sub-universe on the referencing field', async () => {
    const dir = await project({
      'root.yml': universe('root', '[{ id: a, name: A, icon: x, universe: missing.yml }]'),
    })
    expect(errorsOf(await loadArchitecture(path.join(dir, 'root.yml')))).toEqual([
      { file: 'root.yml', field: 'nodes[0].universe', message: 'File not found: "missing.yml"', line: 3, column: 46 },
    ])
  })

  it('reports a missing root file', async () => {
    const dir = await project({})
    expect(errorsOf(await loadArchitecture(path.join(dir, 'nope.yml')))).toEqual([
      { file: 'nope.yml', message: 'File not found: "' + path.join(dir, 'nope.yml') + '"' },
    ])
  })

  it('detects circular references with the full chain', async () => {
    const dir = await project({
      'root.yml': universe('root', '[{ id: a, name: A, icon: x, universe: a.yml }]'),
      'a.yml': universe('a', '[{ id: b, name: B, icon: x, universe: b.yml }]'),
      'b.yml': universe('b', '[{ id: x, name: X, icon: x }, { id: back, name: Back, icon: x, universe: a.yml }]'),
    })
    expect(errorsOf(await loadArchitecture(path.join(dir, 'root.yml')))).toEqual([
      {
        file: 'b.yml',
        field: 'nodes[1].universe',
        message: 'Circular universe reference: a.yml → b.yml → a.yml',
        line: 3,
        column: 81,
      },
    ])
  })

  it('detects a universe referencing itself', async () => {
    const dir = await project({ 'root.yml': universe('root', '[{ id: a, name: A, icon: x, universe: ./root.yml }]') })
    const [error] = errorsOf(await loadArchitecture(path.join(dir, 'root.yml')))
    expect(error).toMatchObject({ file: 'root.yml', field: 'nodes[0].universe', message: 'Circular universe reference: root.yml → root.yml' })
  })

  it('rejects duplicate universe ids across files', async () => {
    const dir = await project({
      'root.yml': universe('root', '[{ id: a, name: A, icon: x, universe: a.yml }]'),
      'a.yml': universe('root'),
    })
    expect(errorsOf(await loadArchitecture(path.join(dir, 'root.yml')))).toEqual([
      { file: 'a.yml', field: 'id', message: 'Universe id "root" is already used by root.yml', line: 1, column: 5 },
    ])
  })

  it('still follows the references of a file that has errors', async () => {
    const dir = await project({
      'root.yml': universe('root', '[{ id: a, name: A, icon: x, universe: a.yml }, { id: bad }]'),
      'a.yml': universe('a', '[{ id: m, name: M, icon: x, universe: missing.yml }]'),
    })
    const errors = errorsOf(await loadArchitecture(path.join(dir, 'root.yml')))
    expect(errors.map((e) => `${e.file} ${e.field}`)).toEqual([
      'root.yml nodes[1].name',
      'root.yml nodes[1].icon',
      'a.yml nodes[0].universe',
    ])
  })

  it('keeps going and collects errors from several files', async () => {
    const dir = await project({
      'root.yml': universe('root', '[{ id: a, name: A, icon: x, universe: a.yml }, { id: b, name: B, icon: x, universe: b.yml }]'),
      'a.yml': universe('a', '[{ id: n, name: 1, icon: x }]'),
      'b.yml': 'id: b\nname: [oops\n',
    })
    const files = errorsOf(await loadArchitecture(path.join(dir, 'root.yml'))).map((e) => e.file)
    expect(files).toContain('a.yml')
    expect(files).toContain('b.yml')
  })

  it('reports YAML syntax errors with their position', async () => {
    const dir = await project({ 'root.yml': 'id: root\nname: Root\nnodes:\n  - id: a\n   name: A\n' })
    const [error] = errorsOf(await loadArchitecture(path.join(dir, 'root.yml')))
    expect(error).toMatchObject({ file: 'root.yml', line: 5, column: 1 })
    expect(error!.message).toMatch(/^Invalid YAML:/)
  })

  it('reports JSON syntax errors', async () => {
    const dir = await project({ 'root.json': '{ "id": "root", }' })
    const [error] = errorsOf(await loadArchitecture(path.join(dir, 'root.json')))
    expect(error).toMatchObject({ file: 'root.json' })
    expect(error!.message).toMatch(/^Invalid JSON:/)
  })

  it('gives JSON files field positions too', async () => {
    const dir = await project({ 'root.json': '{\n  "id": "root",\n  "name": 42,\n  "nodes": []\n}' })
    expect(errorsOf(await loadArchitecture(path.join(dir, 'root.json')))).toEqual([
      { file: 'root.json', field: 'name', message: '"name" must be a string, got number', line: 3, column: 11 },
    ])
  })

  it('rejects files above the size limit', async () => {
    const dir = await project({ 'root.yml': `# ${'x'.repeat(MAX_CONFIG_FILE_BYTES)}\n${universe('root')}` })
    const [error] = errorsOf(await loadArchitecture(path.join(dir, 'root.yml')))
    expect(error!.message).toMatch(/too large/)
  })

  it('rejects unsupported extensions', async () => {
    const dir = await project({
      'root.yml': universe('root', '[{ id: a, name: A, icon: x, universe: a.js }]'),
      'a.js': 'module.exports = {}',
    })
    const [error] = errorsOf(await loadArchitecture(path.join(dir, 'root.yml')))
    expect(error).toMatchObject({ field: 'nodes[0].universe', message: 'Unsupported file type for "a.js" (expected .yml, .yaml, .json)' })
  })
})

describe('loadArchitecture - file access confinement', () => {
  it('rejects paths leaving the project directory', async () => {
    const outside = await project({ 'secret.yml': universe('secret') })
    const dir = await project({
      'root.yml': universe('root', `[{ id: a, name: A, icon: x, universe: ../${path.basename(outside)}/secret.yml }]`),
    })
    const [error] = errorsOf(await loadArchitecture(path.join(dir, 'root.yml')))
    expect(error).toMatchObject({ file: 'root.yml', field: 'nodes[0].universe' })
    expect(error!.message).toMatch(/outside the project directory/)
  })

  it('rejects absolute paths and URLs', async () => {
    const dir = await project({
      'root.yml': universe(
        'root',
        '[{ id: a, name: A, icon: x, universe: /etc/passwd.yml }, { id: b, name: B, icon: x, universe: "https://example.com/u.yml" }]',
      ),
    })
    const errors = errorsOf(await loadArchitecture(path.join(dir, 'root.yml')))
    expect(errors.map((e) => e.field)).toEqual(['nodes[0].universe', 'nodes[1].universe'])
    for (const error of errors) expect(error.message).toMatch(/must be a path relative/)
  })

  it('rejects symlinks escaping the project directory', async () => {
    const outside = await project({ 'secret.yml': universe('secret'), 'logo.svg': '<svg/>' })
    const dir = await project({
      'root.yml': universe('root', '[{ id: a, name: A, icon: ./logo.svg, universe: ./link.yml }]'),
    })
    await symlink(path.join(outside, 'secret.yml'), path.join(dir, 'link.yml'))
    await symlink(path.join(outside, 'logo.svg'), path.join(dir, 'logo.svg'))
    const errors = errorsOf(await loadArchitecture(path.join(dir, 'root.yml')))
    expect(errors.map((e) => [e.field, e.message])).toEqual([
      ['nodes[0].icon', '"./logo.svg" resolves outside the project directory'],
      ['nodes[0].universe', '"./link.yml" resolves outside the project directory'],
    ])
  })

  it('honours an explicit project root', async () => {
    const dir = await project({
      'shared/common.yml': universe('common'),
      'app/root.yml': universe('root', '[{ id: c, name: C, icon: x, universe: ../shared/common.yml }]'),
    })
    expect(errorsOf(await loadArchitecture(path.join(dir, 'app/root.yml')))[0]!.message).toMatch(/outside/)
    const result = await loadArchitecture(path.join(dir, 'app/root.yml'), { projectRoot: dir })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.architecture.universes['root']!.source).toBe('app/root.yml')
  })

  it('rejects a root file outside the explicit project root', async () => {
    const dir = await project({ 'a/root.yml': universe('root'), 'b/.keep': '' })
    const [error] = errorsOf(await loadArchitecture(path.join(dir, 'a/root.yml'), { projectRoot: path.join(dir, 'b') }))
    expect(error!.message).toMatch(/outside the project directory/)
  })
})

describe('loadArchitecture - icons', () => {
  it('resolves named icons and local image files', async () => {
    const dir = await project({
      'root.yml': universe(
        'root',
        '[{ id: a, name: A, icon: docker }, { id: b, name: B, icon: img/logo.SVG }, { id: c, name: C, icon: img/c.png }, { id: d, name: D, icon: ./img/d.webp }, { id: e, name: E, icon: img/e.JPG }, { id: f, name: F, icon: img/f.jpeg }]',
      ),
      'img/logo.SVG': '<svg/>',
      'img/c.png': 'png',
      'img/d.webp': 'webp',
      'img/e.JPG': 'jpg',
      'img/f.jpeg': 'jpeg',
    })
    const result = await loadArchitecture(path.join(dir, 'root.yml'))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.architecture.universes['root']!.nodes.map((n) => n.icon)).toEqual([
        { type: 'name', name: 'docker' },
        { type: 'file', path: 'img/logo.SVG' },
        { type: 'file', path: 'img/c.png' },
        { type: 'file', path: 'img/d.webp' },
        { type: 'file', path: 'img/e.JPG' },
        { type: 'file', path: 'img/f.jpeg' },
      ])
    }
  })

  it('reports missing icon files and invalid icon references', async () => {
    const dir = await project({
      'root.yml': universe('root', '[{ id: a, name: A, icon: nope.png }, { id: b, name: B, icon: "img/logo.gif" }]'),
    })
    expect(errorsOf(await loadArchitecture(path.join(dir, 'root.yml'))).map((e) => [e.field, e.message])).toEqual([
      ['nodes[0].icon', 'File not found: "nope.png"'],
      [
        'nodes[1].icon',
        'Invalid icon "img/logo.gif": use an icon name ("docker", "mdi:database", "logos:react") or a relative path to an image file (.svg, .png, .webp, .jpg, .jpeg)',
      ],
    ])
  })
})

describe('loadArchitecture - groups and tags', () => {
  it('normalizes groups, group icons, node groups and tags', async () => {
    const dir = await project({
      'root.yml': [
        'id: root',
        'name: Root',
        'groups:',
        '  - { id: vercel, name: Vercel, icon: vercel }',
        '  - { id: own, name: Own, icon: img/own.png }',
        '  - { id: plain, name: Plain }',
        'nodes:',
        "  - { id: next, name: Next.js, icon: nextdotjs, group: vercel, tags: ['€20/mo', { text: beta, corner: bottom-left }] }",
        '  - { id: api, name: API, icon: x, group: own }',
        '  - { id: db, name: DB, icon: x, group: plain }',
        '  - { id: alone, name: Alone, icon: x }',
        '',
      ].join('\n'),
      'img/own.png': 'png',
    })
    const result = await loadArchitecture(path.join(dir, 'root.yml'))
    if (!result.ok) throw new Error(result.errors.map(formatConfigError).join('\n'))
    const root = result.architecture.universes['root']!
    expect(root.groups).toEqual([
      { id: 'vercel', name: 'Vercel', icon: { type: 'name', name: 'vercel' } },
      { id: 'own', name: 'Own', icon: { type: 'file', path: 'img/own.png' } },
      { id: 'plain', name: 'Plain' },
    ])
    expect(root.nodes[0]).toEqual({
      id: 'next',
      name: 'Next.js',
      icon: { type: 'name', name: 'nextdotjs' },
      group: 'vercel',
      tags: [
        { text: '€20/mo', corner: 'top-right' },
        { text: 'beta', corner: 'bottom-left' },
      ],
    })
    expect(root.nodes[3]).toEqual({ id: 'alone', name: 'Alone', icon: { type: 'name', name: 'x' } })
    expect(result.files.some((f) => f.endsWith('own.png'))).toBe(true)
  })

  it('reports a missing group icon on its field', async () => {
    const dir = await project({
      'root.yml': 'id: root\nname: Root\ngroups:\n  - { id: g, name: G, icon: nope.svg }\nnodes:\n  - { id: a, name: A, icon: x, group: g }\n',
    })
    expect(errorsOf(await loadArchitecture(path.join(dir, 'root.yml')))).toEqual([
      { file: 'root.yml', field: 'groups[0].icon', message: 'File not found: "nope.svg"', line: 4, column: 29 },
    ])
  })
})

describe('loadArchitecture - errors only leave out the elements they concern', () => {
  async function partial(files: Record<string, string>) {
    const dir = await project(files)
    const result = await loadArchitecture(path.join(dir, 'root.yml'))
    expect(result.ok).toBe(false)
    if (!result.architecture) throw new Error('expected a partial architecture')
    return { errors: result.errors, architecture: result.architecture }
  }

  it('drops an invalid icon, description, tag, color or border, and keeps the node', async () => {
    const { errors, architecture } = await partial({
      'root.yml': [
        'id: root',
        'name: Root',
        'nodes:',
        '  - id: a',
        '    name: A',
        '    icon: my_set:react',
        '    description: 42',
        '    tags: [ok, "", { text: x, corner: middle }]',
        '    color: rgb(1,2,3)',
        '    border: thick',
        '  - { id: b, name: B, icon: missing.svg }',
        '',
      ].join('\n'),
    })
    expect(errors.map((e) => e.field)).toEqual([
      'nodes[0].description',
      'nodes[0].tags[1]',
      'nodes[0].tags[2].corner',
      'nodes[0].color',
      'nodes[0].border',
      'nodes[0].icon',
      'nodes[1].icon',
    ])
    expect(architecture.universes['root']!.nodes).toEqual([
      { id: 'a', name: 'A', tags: [{ text: 'ok', corner: 'top-right' }] },
      { id: 'b', name: 'B' },
    ])
  })

  it('drops a connection with an invalid style, color, arrow or end, and keeps the label-less one', async () => {
    const { errors, architecture } = await partial({
      'root.yml': universe(
        'root',
        '[{ id: a, name: A, icon: x }, { id: b, name: B, icon: x }]',
        '[{ from: a, to: b, style: wavy }, { from: a, to: b, color: nope }, { from: a, to: b, arrow: middle }, { from: a, to: zzz }, { from: b, to: a, label: 7 }, { from: a, to: b, label: ok }]',
      ),
    })
    expect(errors.map((e) => e.field)).toEqual(['connections[0].style', 'connections[1].color', 'connections[2].arrow', 'connections[3].to', 'connections[4].label'])
    expect(architecture.universes['root']!.edges).toEqual([
      { id: 'e0', from: 'b', to: 'a' },
      { id: 'e1', from: 'a', to: 'b', label: 'ok' },
    ])
  })

  it('drops a node without a valid id or name, and its connections', async () => {
    const { errors, architecture } = await partial({
      'root.yml': universe('root', '[{ id: a, icon: x }, { id: b, name: B, icon: x }, { name: C, icon: x }]', '[{ from: a, to: b }, { from: b, to: b }]'),
    })
    expect(errors.map((e) => e.field)).toEqual(['nodes[0].name', 'nodes[2].id'])
    const root = architecture.universes['root']!
    expect(root.nodes.map((n) => n.id)).toEqual(['b'])
    expect(root.edges).toEqual([{ id: 'e0', from: 'b', to: 'b' }])
  })

  it('drops an invalid group frame and keeps its nodes, and ignores an invalid group style', async () => {
    const { errors, architecture } = await partial({
      'root.yml': [
        'id: root',
        'name: Root',
        'direction: diagonal',
        'groups:',
        '  - { id: g1, icon: x }',
        '  - { id: g2, name: G2, color: nope, border: thick }',
        '  - { id: g3, name: Empty }',
        'nodes:',
        '  - { id: a, name: A, icon: x, group: g1 }',
        '  - { id: b, name: B, icon: x, group: g2 }',
        '  - { id: c, name: C, icon: x, group: zzz }',
        '',
      ].join('\n'),
    })
    expect(errors.map((e) => e.field)).toEqual(['direction', 'groups[0].name', 'groups[1].color', 'groups[1].border', 'nodes[2].group', 'groups[2]'])
    const root = architecture.universes['root']!
    expect(root.direction).toBe('right')
    expect(root.groups).toEqual([{ id: 'g2', name: 'G2' }])
    expect(root.nodes.map((n) => [n.id, n.group])).toEqual([
      ['a', undefined],
      ['b', 'g2'],
      ['c', undefined],
    ])
  })

  it('drops links to broken, missing, duplicate or circular universes, and keeps the nodes', async () => {
    const { errors, architecture } = await partial({
      'root.yml': universe(
        'root',
        '[{ id: a, name: A, icon: x, universe: broken.yml }, { id: b, name: B, icon: x, universe: missing.yml }, { id: c, name: C, icon: x, universe: twin.yml }, { id: d, name: D, icon: x, universe: sub.yml }]',
      ),
      'broken.yml': 'id: broken\nname: [x\n',
      'twin.yml': universe('root'),
      'sub.yml': universe('sub', '[{ id: back, name: Back, icon: x, universe: root.yml }]'),
    })
    expect(errors.map((e) => `${e.file} ${e.field ?? ''}`.trim())).toEqual([
      'root.yml nodes[1].universe',
      'broken.yml',
      'twin.yml id',
      'sub.yml nodes[0].universe',
    ])
    expect(Object.keys(architecture.universes)).toEqual(['root', 'sub'])
    expect(architecture.universes['root']!.nodes.map((n) => n.universe)).toEqual([undefined, undefined, undefined, 'sub'])
    expect(architecture.universes['sub']!.nodes).toEqual([{ id: 'back', name: 'Back', icon: { type: 'name', name: 'x' } }])
  })

  it('names a universe without a valid id after its file', async () => {
    const { errors, architecture } = await partial({
      'root.yml': universe('root', '[{ id: a, name: A, icon: x, universe: sub/my-sub.yml }]'),
      'sub/my-sub.yml': 'id: "not an id"\nnodes: []\n',
    })
    expect(errors.map((e) => e.field)).toEqual(['id', 'name'])
    expect(architecture.universes['sub-my-sub']).toMatchObject({ id: 'sub-my-sub', name: 'sub-my-sub', source: 'sub/my-sub.yml' })
    expect(architecture.universes['root']!.nodes[0]!.universe).toBe('sub-my-sub')
  })

  it('has no architecture when the root universe cannot be read', async () => {
    const dir = await project({ 'root.yml': 'id: root\nname: [broken\n' })
    const result = await loadArchitecture(path.join(dir, 'root.yml'))
    expect(result.ok).toBe(false)
    expect(result.architecture).toBeUndefined()
  })
})

describe('loadArchitecture - connections into sub-universes', () => {
  const files = {
    'root.yml': universe(
      'root',
      '[{ id: ci, name: CI, icon: x }, { id: org, name: Org, icon: x, universe: org.yml }]',
      '[{ from: ci, to: org/vps/api, label: deploy }, { from: { node: org/backups, side: left }, to: ci }]',
    ),
    'org.yml': universe('org', '[{ id: vps, name: VPS, icon: x, universe: vps.yml }, { id: backups, name: Backups, icon: x }]'),
    'vps.yml': universe('vps', '[{ id: api, name: API, icon: x }]'),
  }

  it('resolves paths across one and several levels', async () => {
    const dir = await project(files)
    const result = await loadArchitecture(path.join(dir, 'root.yml'))
    if (!result.ok) throw new Error(result.errors.map(formatConfigError).join('\n'))
    expect(result.architecture.universes['root']!.edges).toEqual([
      { id: 'e0', from: 'ci', to: 'org', toPath: ['vps', 'api'], label: 'deploy' },
      { id: 'e1', from: 'org', to: 'ci', fromPath: ['backups'], fromSide: 'left' },
    ])
  })

  it('leaves out a connection whose path cannot be reached, and says why', async () => {
    const dir = await project({
      ...files,
      'root.yml': universe(
        'root',
        '[{ id: ci, name: CI, icon: x }, { id: org, name: Org, icon: x, universe: org.yml }, { id: gone, name: Gone, icon: x, universe: missing.yml }]',
        '[{ from: ci, to: org/vps/apii }, { from: ci, to: gone/x }, { from: ci, to: org/vps }]',
      ),
    })
    const result = await loadArchitecture(path.join(dir, 'root.yml'))
    expect(result.errors.map((e) => [e.field, e.message])).toEqual([
      ['nodes[2].universe', expect.stringMatching(/^File not found/)],
      ['connections[0].to', 'Unknown node "apii" in universe "vps" ("org/vps/apii")'],
      ['connections[1].to', 'The universe of "gone" is not available ("gone/x")'],
    ])
    expect(result.architecture?.universes['root']!.edges).toEqual([{ id: 'e0', from: 'ci', to: 'org', toPath: ['vps'] }])
  })
})

describe('loadArchitecture - universe background', () => {
  it('resolves the background image like a local icon, and watches it', async () => {
    const dir = await project({
      'root.yml': ['id: root', 'name: Root', 'background: { image: images/bg.png, blur: 6, color: "#102030" }', 'nodes: []', ''].join('\n'),
      'images/bg.png': 'png',
    })
    const result = await loadArchitecture(path.join(dir, 'root.yml'))
    if (!result.ok) throw new Error(result.errors.map(formatConfigError).join('\n'))
    expect(result.architecture.universes['root']!.background).toEqual({ image: 'images/bg.png', color: '#102030', blur: 6 })
    expect(result.files.map((f) => path.relative(dir, f))).toContain(path.join('images', 'bg.png'))
  })

  it('leaves out an invalid image, and keeps the color and blur', async () => {
    const cases: [string, RegExp][] = [
      ['missing.jpg', /^File not found: "missing.jpg"/],
      ['../outside.png', /outside the project/],
      ['unsafe.svg', /^Invalid SVG "unsafe.svg": it contains a script$/],
      ['docker', /^"image" must be a relative path to an image file \(.svg, .png, .webp, .jpg, .jpeg\), got "docker"$/],
    ]
    for (const [image, message] of cases) {
      const dir = await project({
        'root.yml': ['id: root', 'name: Root', `background: { image: "${image}", blur: 4 }`, 'nodes: []', ''].join('\n'),
        'unsafe.svg': '<svg xmlns="http://www.w3.org/2000/svg"><script>x()</script></svg>',
      })
      const result = await loadArchitecture(path.join(dir, 'root.yml'))
      expect(result.errors.map((e) => e.field)).toEqual(['background.image'])
      expect(result.errors[0]!.message).toMatch(message)
      expect(result.architecture?.universes['root']!.background).toEqual({ blur: 4 })
    }
  })
})

describe('loadArchitecture - icon references', () => {
  it('accepts any collection prefix, and checks the syntax of references', async () => {
    const valid = await project({
      'root.yml': universe(
        'root',
        '[{ id: a, name: A, icon: logos:react }, { id: b, name: B, icon: DevIcon:docker }, { id: c, name: C, icon: dashboard:home-assistant }, { id: d, name: D, icon: mdi:database }, { id: e, name: E, icon: Tabler:Server }, { id: f, name: F, icon: simple-icons:github }]',
      ),
    })
    const result = await loadArchitecture(path.join(valid, 'root.yml'))
    if (!result.ok) throw new Error(result.errors.map(formatConfigError).join('\n'))
    expect(result.architecture.universes['root']!.nodes.map((n) => n.icon)).toEqual([
      { type: 'name', name: 'logos:react' },
      { type: 'name', name: 'DevIcon:docker' },
      { type: 'name', name: 'dashboard:home-assistant' },
      { type: 'name', name: 'mdi:database' },
      { type: 'name', name: 'Tabler:Server' },
      { type: 'name', name: 'simple-icons:github' },
    ])

    const dir = await project({
      'root.yml': universe(
        'root',
        '[{ id: a, name: A, icon: "my_set:react" }, { id: b, name: B, icon: "mdi:data_base" }, { id: c, name: C, icon: "a:b:c" }, { id: d, name: D, icon: "mdi:" }, { id: e, name: E, icon: "mdi:-x" }]',
      ),
    })
    expect(errorsOf(await loadArchitecture(path.join(dir, 'root.yml'))).map((e) => [e.field, e.message])).toEqual([
      ['nodes[0].icon', 'Invalid icon "my_set:react": "my_set" is not a collection prefix (lowercase letters, digits and single hyphens, e.g. "mdi", "simple-icons")'],
      ['nodes[1].icon', 'Invalid icon "mdi:data_base": "data_base" is not an Iconify icon name (lowercase letters, digits and single hyphens, e.g. "mdi:database")'],
      ['nodes[2].icon', expect.stringContaining('Invalid icon "a:b:c": use an icon name')],
      ['nodes[3].icon', 'Invalid icon "mdi:": "" is not an Iconify icon name (lowercase letters, digits and single hyphens, e.g. "mdi:database")'],
      ['nodes[4].icon', 'Invalid icon "mdi:-x": "-x" is not an Iconify icon name (lowercase letters, digits and single hyphens, e.g. "mdi:database")'],
    ])
  })

  it('validates local SVG icons', async () => {
    const dir = await project({
      'root.yml': universe(
        'root',
        '[{ id: a, name: A, icon: ok.svg }, { id: b, name: B, icon: script.svg }, { id: c, name: C, icon: remote.svg }, { id: d, name: D, icon: text.svg }]',
      ),
      'ok.svg': '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"><use href="#a"/></svg>\n',
      'script.svg': '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      'remote.svg': '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/t.png"/></svg>',
      'text.svg': 'hello',
    })
    expect(errorsOf(await loadArchitecture(path.join(dir, 'root.yml'))).map((e) => [e.field, e.message])).toEqual([
      ['nodes[1].icon', 'Invalid SVG "script.svg": it contains a script'],
      ['nodes[2].icon', 'Invalid SVG "remote.svg": it links to an external resource'],
      ['nodes[3].icon', 'Invalid SVG "text.svg": it is not an SVG document'],
    ])
  })
})

describe('formatConfigError', () => {
  it('formats file, position and field', () => {
    expect(formatConfigError({ file: 'a.yml', field: 'nodes[0].id', message: 'Bad', line: 3, column: 9 })).toBe(
      'a.yml:3:9 nodes[0].id: Bad',
    )
    expect(formatConfigError({ file: 'a.yml', message: 'Bad' })).toBe('a.yml: Bad')
  })
})
