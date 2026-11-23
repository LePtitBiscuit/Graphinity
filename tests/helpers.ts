import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach } from 'vitest'
import type { ConfigError, LoadResult } from '../src/core/index.ts'

const created: string[] = []

afterEach(async () => {
  await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

/** Writes the given files into a fresh temporary directory and returns its path. */
export async function project(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'graphinity-'))
  created.push(dir)
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(dir, name)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, content)
  }
  return dir
}

export function errorsOf(result: LoadResult): ConfigError[] {
  if (result.ok) throw new Error('Expected the load to fail')
  return result.errors
}

/** Minimal valid universe in YAML. */
export function universe(id: string, nodes = '[]', edges = '[]'): string {
  return `id: ${id}\nname: ${id}\nnodes: ${nodes}\nconnections: ${edges}\n`
}
