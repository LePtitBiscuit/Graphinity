import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { initProject, starterFiles } from '../../src/cli/init.ts'
import { buildViewerData, formatConfigError, loadArchitecture } from '../../src/core/index.ts'
import { openNode, rootPath } from '../../viewer/src/navigation.ts'
import { project } from '../helpers.ts'

/** Every file and folder under `dir`, relative, with `/`. */
async function tree(dir: string, prefix = ''): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`
    out.push(entry.isDirectory() ? `${relative}/` : relative)
    if (entry.isDirectory()) out.push(...(await tree(path.join(dir, entry.name), `${relative}/`)))
  }
  return out.sort()
}

describe('initProject', () => {
  it('creates the starter project in an empty directory', async () => {
    const dir = await project({})
    const result = await initProject({ dir })
    expect(result).toEqual({ ok: true, created: ['architecture.yml', 'universes/example.yml', 'assets/icons/'], overwritten: [] })
    expect(await tree(dir)).toEqual(['architecture.yml', 'assets/', 'assets/icons/', 'universes/', 'universes/example.yml'])
  })

  it('creates a valid project, with a universe to open, that needs no network', async () => {
    const dir = await project({})
    await initProject({ dir })
    // tests/setup.ts runs offline: only icons bundled with the package can resolve.
    const result = await loadArchitecture(path.join(dir, 'architecture.yml'))
    expect(result.ok, result.errors.map(formatConfigError).join('\n')).toBe(true)
    if (!result.ok) return
    const { warnings } = await buildViewerData(result.architecture)
    expect(warnings.map(formatConfigError)).toEqual([])

    const { architecture } = result
    expect(Object.keys(architecture.universes)).toEqual(['my-system', 'api'])
    const inside = openNode(architecture, rootPath(architecture), 'api')
    expect(inside).toEqual(['my-system', 'api'])
    // Connections reach into the sub-universe (paths).
    expect(architecture.universes['my-system']!.edges.map((e) => [e.fromPath, e.toPath])).toContainEqual([undefined, ['server']])
  })

  it('creates the directory and its parents when missing', async () => {
    const root = await project({})
    const dir = path.join(root, 'a', 'b')
    expect((await initProject({ dir })).ok).toBe(true)
    expect(existsSync(path.join(dir, 'universes', 'example.yml'))).toBe(true)
  })

  it('keeps existing folders and lists only what it creates', async () => {
    const dir = await project({ 'assets/icons/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>' })
    const result = await initProject({ dir })
    expect(result).toEqual({ ok: true, created: ['architecture.yml', 'universes/example.yml'], overwritten: [] })
    expect(existsSync(path.join(dir, 'assets', 'icons', 'logo.svg'))).toBe(true)
  })

  it('never overwrites a file without a confirmation, and then writes nothing at all', async () => {
    const dir = await project({ 'architecture.yml': 'mine' })
    const result = await initProject({ dir })
    expect(result).toEqual({ ok: false, existing: ['architecture.yml'], declined: false })
    expect(await readFile(path.join(dir, 'architecture.yml'), 'utf8')).toBe('mine')
    expect(await tree(dir)).toEqual(['architecture.yml'])

    let asked: string[] = []
    const declined = await initProject({ dir, confirm: async (existing) => ((asked = existing), false) })
    expect(asked).toEqual(['architecture.yml'])
    expect(declined).toEqual({ ok: false, existing: ['architecture.yml'], declined: true })
    expect(await tree(dir)).toEqual(['architecture.yml'])
  })

  it('overwrites after a confirmation or with force', async () => {
    for (const options of [{ confirm: async () => true }, { force: true }]) {
      const dir = await project({ 'architecture.yml': 'mine' })
      const result = await initProject({ dir, ...options })
      expect(result).toEqual({ ok: true, created: ['universes/example.yml', 'assets/icons/'], overwritten: ['architecture.yml'] })
      expect(await readFile(path.join(dir, 'architecture.yml'), 'utf8')).toBe(starterFiles()['architecture.yml'])
    }
  })

  it('refuses a folder where a file goes, and a file where a folder goes', async () => {
    const folder = await project({})
    await mkdir(path.join(folder, 'architecture.yml'))
    await expect(initProject({ dir: folder, force: true })).rejects.toThrow('"architecture.yml" is a directory')
    const file = await project({ universes: 'not a folder' })
    await expect(initProject({ dir: file, force: true })).rejects.toThrow('"universes" is a file')
    expect(await tree(file)).toEqual(['universes'])
  })

  it('leaves nothing behind when writing fails', async () => {
    const dir = await project({})
    // A leftover with the name of a staged file makes the second write fail.
    await mkdir(path.join(dir, 'universes'))
    await writeFile(path.join(dir, 'universes', `example.yml.graphinity-init-${process.pid}`), 'leftover')
    await expect(initProject({ dir })).rejects.toThrow()
    expect(existsSync(path.join(dir, 'architecture.yml'))).toBe(false)
    expect(existsSync(path.join(dir, 'assets'))).toBe(false)
    expect(await tree(dir)).toEqual(['universes/', 'universes/example.yml.graphinity-init-' + process.pid].sort())
  })
})
