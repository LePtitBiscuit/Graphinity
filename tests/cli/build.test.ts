import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildSite, BUILD_MARKER } from '../../src/cli/build.ts'
import { project, universe } from '../helpers.ts'

/** A minimal stand-in for the precompiled viewer. */
async function fakeViewer(): Promise<string> {
  return project({ 'index.html': '<html><head></head><body>viewer</body></html>', 'assets/app.js': 'app' })
}

async function example() {
  return project({
    'arch/root.yml':
      'id: root\nname: root\nbackground: { image: images/bg.jpg, blur: 4 }\ngroups: [{ id: cloud, name: Cloud, icon: icons/cloud.svg }]\n' +
      'nodes: [{ id: a, name: A, icon: icons/a.svg, universe: sub/a.yml, group: cloud }, { id: g, name: G, icon: github }]\n',
    'arch/icons/cloud.svg': '<svg id="cloud"/>',
    'arch/images/bg.jpg': 'jpg bytes',
    'arch/sub/a.yml': universe('a', '[{ id: b, name: B, icon: ../icons/b.svg }, { id: c, name: C, icon: ../icons/c.png }, { id: r, name: R, icon: logos:react }]'),
    'arch/icons/a.svg': '<svg id="a"/>',
    'arch/icons/b.svg': '<svg id="b"/>',
    'arch/icons/c.png': 'png bytes',
    'arch/icons/unused.svg': '<svg/>',
    'arch/secret.txt': 'not referenced',
  })
}

describe('buildSite', () => {
  it('writes the viewer, the data and only the referenced icons', async () => {
    const [viewerDir, dir] = await Promise.all([fakeViewer(), example()])
    const out = path.join(dir, 'site')
    const result = await buildSite({ file: path.join(dir, 'arch/root.yml'), projectRoot: path.join(dir, 'arch'), outDir: out, viewerDir })
    expect(result.ok).toBe(true)

    const all = (await readdir(out, { recursive: true })).map((f) => f.split(path.sep).join('/')).sort()
    // Icons of collections: only the one used, and the attributions (SVG Logos is CC0: no license text).
    const generated = all.filter((f) => f.startsWith('icons'))
    const svg = generated.find((f) => /^icons\/[0-9a-f]{16}\.svg$/.test(f))
    expect(generated.sort()).toEqual(['icons', 'icons/ATTRIBUTIONS.md', svg].sort())
    const files = all.filter((f) => !f.startsWith('icons'))
    expect(files).toEqual([
      BUILD_MARKER,
      'architecture.json',
      'assets',
      'assets/app.js',
      'files',
      'files/icons',
      'files/icons/a.svg',
      'files/icons/b.svg',
      'files/icons/c.png',
      'files/icons/cloud.svg',
      'files/images',
      'files/images/bg.jpg',
      'index.html',
    ])
    const data = JSON.parse(await readFile(path.join(out, 'architecture.json'), 'utf8'))
    expect(data.architecture.root).toBe('root')
    expect(Object.keys(data.architecture.universes)).toEqual(['root', 'a'])
    expect(Object.keys(data.icons)).toEqual(['github', 'logos:react'])
    expect(data.icons['logos:react'].src).toBe(svg)
    expect(await readFile(path.join(out, svg!), 'utf8')).toMatch(/^<svg xmlns/)
    expect(await readFile(path.join(out, 'files/icons/b.svg'), 'utf8')).toBe('<svg id="b"/>')
  })

  it('rebuilds over its own output, removing stale files', async () => {
    const [viewerDir, dir] = await Promise.all([fakeViewer(), example()])
    const options = { file: path.join(dir, 'arch/root.yml'), projectRoot: path.join(dir, 'arch'), outDir: path.join(dir, 'site'), viewerDir }
    await buildSite(options)
    await writeFile(path.join(dir, 'site/stale.txt'), 'old')
    expect((await buildSite(options)).ok).toBe(true)
    expect(await readdir(path.join(dir, 'site'))).not.toContain('stale.txt')
  })

  it('never empties a directory it did not create', async () => {
    const [viewerDir, dir] = await Promise.all([fakeViewer(), example()])
    await mkdir(path.join(dir, 'mine'))
    await writeFile(path.join(dir, 'mine/notes.txt'), 'keep me')
    const result = await buildSite({ file: path.join(dir, 'arch/root.yml'), projectRoot: path.join(dir, 'arch'), outDir: path.join(dir, 'mine'), viewerDir })
    expect(result).toEqual({ ok: false, refused: expect.stringMatching(/not empty and was not created by graphinity/) })
    expect(await readFile(path.join(dir, 'mine/notes.txt'), 'utf8')).toBe('keep me')
  })

  it('refuses outputs that would contain the project, the working directory or the viewer', async () => {
    const [viewerDir, dir] = await Promise.all([fakeViewer(), example()])
    const base = { file: path.join(dir, 'arch/root.yml'), projectRoot: path.join(dir, 'arch'), viewerDir }
    for (const outDir of [path.join(dir, 'arch'), dir, process.cwd(), path.dirname(viewerDir), path.join(viewerDir, 'x')]) {
      const result = await buildSite({ ...base, outDir })
      expect(result.ok, outDir).toBe(false)
      expect('refused' in result && result.refused).toBeTruthy()
    }
  })

  it('reports configuration errors without touching the output', async () => {
    const [viewerDir, dir] = await Promise.all([fakeViewer(), project({ 'root.yml': 'id: root\nname: [x\n' })])
    const out = path.join(dir, 'site')
    const result = await buildSite({ file: path.join(dir, 'root.yml'), projectRoot: dir, outDir: out, viewerDir })
    expect(result.ok).toBe(false)
    expect('errors' in result && result.errors[0]!.file).toBe('root.yml')
    await expect(readdir(out)).rejects.toThrow()
  })
})
