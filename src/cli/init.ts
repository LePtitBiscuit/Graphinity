// `init`: a starter project in a directory (the current one by default). A root universe, a
// sub-universe it opens, and a folder for your own icons. Only icons bundled with the package
// are used, so the project works offline.
//
// Nothing is overwritten without a confirmation (or --force), and nothing is left half-written:
// every file is written next to its target first, then all are moved into place.
import { mkdir, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { docsUrl } from './brand.ts'

/** The files of a new project, by path relative to its directory (always with `/`). */
export function starterFiles(): Record<string, string> {
  const docs = docsUrl()
  return {
    'architecture.yml': [
      '# The root universe of your architecture. Every file describes one level (a universe):',
      '# its nodes, groups and connections. A node opens another level with "universe" -',
      '# double-click it in the viewer.',
      ...(docs ? [`# Documentation: ${docs}`] : []),
      'id: my-system',
      'name: My system',
      'direction: right',
      'nodes:',
      '  - id: web',
      '    name: Web app',
      '    icon: vuedotjs',
      '    description: What your users open.',
      '  - id: api',
      '    name: API',
      '    icon: nodedotjs',
      '    description: Double-click to open its universe.',
      '    universe: ./universes/example.yml',
      '  - id: database',
      '    name: Database',
      '    icon: postgresql',
      '    # Your own logos: put SVG files in assets/icons/ and use them by path, e.g.',
      '    # icon: ./assets/icons/database.svg',
      'connections:',
      '  # "api/server": the node "server" inside the universe opened by "api".',
      '  - from: web',
      '    to: api/server',
      '    label: HTTPS',
      '  - from: api/worker',
      '    to: database',
      '    label: SQL',
      '',
    ].join('\n'),
    'universes/example.yml': [
      '# A sub-universe: what is inside the "API" node of architecture.yml.',
      'id: api',
      'name: API',
      'direction: down',
      'nodes:',
      '  - id: server',
      '    name: Server',
      '    icon: nodedotjs',
      '    description: Answers the web app.',
      '  - id: queue',
      '    name: Job queue',
      '    icon: redis',
      '  - id: worker',
      '    name: Worker',
      '    icon: nodedotjs',
      '    description: Runs the jobs.',
      'connections:',
      '  - from: server',
      '    to: queue',
      '    label: jobs',
      '  - from: queue',
      '    to: worker',
      '',
    ].join('\n'),
  }
}

/** Folders of a new project (created if missing, kept if present). */
export const STARTER_DIRS = ['universes', 'assets/icons'] as const

export interface InitOptions {
  /** The project directory; created if missing. */
  dir: string
  /** Overwrite existing files without asking. */
  force?: boolean
  /** Asked when files would be overwritten (interactive use); refused when absent. */
  confirm?: (existing: string[]) => Promise<boolean>
}

export type InitResult =
  | { ok: true; created: string[]; overwritten: string[] }
  /** Existing files were not overwritten: nothing was written. */
  | { ok: false; existing: string[]; declined: boolean }

const exists = (file: string) =>
  stat(file).then(
    (info) => info,
    () => undefined,
  )

export async function initProject({ dir, force = false, confirm }: InitOptions): Promise<InitResult> {
  const files = starterFiles()
  const at = (relative: string) => path.join(dir, ...relative.split('/'))

  // A folder in the way of a file, or a file in the way of a folder, cannot be overwritten.
  for (const relative of Object.keys(files)) {
    if ((await exists(at(relative)))?.isDirectory()) throw new Error(`"${relative}" is a directory: move it away first.`)
  }
  for (const relative of STARTER_DIRS) {
    const info = await exists(at(relative))
    if (info && !info.isDirectory()) throw new Error(`"${relative}" is a file, not a directory: move it away first.`)
  }

  const existing: string[] = []
  for (const relative of Object.keys(files)) if (await exists(at(relative))) existing.push(relative)
  if (existing.length > 0 && !force) {
    const accepted = confirm ? await confirm(existing) : false
    if (!accepted) return { ok: false, existing, declined: Boolean(confirm) }
  }

  // Folders first (remembered, to remove the new ones if writing fails), then each file next to
  // its target, then all moved into place.
  const madeDirs: string[] = []
  /** Creates a folder and its missing parents, remembering each one created. */
  const ensure = async (folder: string): Promise<void> => {
    if (await exists(folder)) return
    await ensure(path.dirname(folder))
    await mkdir(folder)
    madeDirs.push(folder)
  }
  for (const relative of [...STARTER_DIRS, ...Object.keys(files).map((file) => path.posix.dirname(file))]) {
    await ensure(relative === '.' ? dir : path.join(dir, ...relative.split('/')))
  }
  const staged: [string, string][] = []
  try {
    for (const [relative, content] of Object.entries(files)) {
      const temporary = `${at(relative)}.graphinity-init-${process.pid}`
      // "wx": never replaces a file; only what was written here is removed on failure.
      await writeFile(temporary, content, { flag: 'wx' })
      staged.push([temporary, at(relative)])
    }
    for (const [temporary, target] of staged) await rename(temporary, target)
  } catch (error) {
    for (const [temporary] of staged) await rm(temporary, { force: true })
    for (const folder of madeDirs.reverse()) await rmdir(folder).catch(() => undefined)
    throw error
  }

  // Folders that hold a new file are listed through it (universes/example.yml).
  const newDirs = STARTER_DIRS.filter((folder) => madeDirs.includes(at(folder)) && !Object.keys(files).some((file) => file.startsWith(`${folder}/`))).map(
    (folder) => `${folder}/`,
  )
  const created = [...Object.keys(files).filter((file) => !existing.includes(file)), ...newDirs]
  return { ok: true, created, overwritten: existing }
}
