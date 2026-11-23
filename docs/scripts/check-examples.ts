// Validates every complete configuration example of the documentation with the real engine.
//
// A complete example is a fenced block titled with a file name: ```yaml [architecture.yml]
// Consecutive titled blocks of a page form one project (written to a temporary directory) until a
// file name repeats. The first file of a project is its root; a file it does not reach (e.g. the
// JSON version of a YAML example) is checked as a root of its own. Local icon files referenced by
// the examples are created as placeholders. Every named icon must exist in its collection. Untitled
// blocks are fragments and are not checked.
//
// Run with: pnpm docs:check
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildViewerData, formatConfigError, ICON_EXTENSIONS, loadArchitecture } from '../../src/core/index.ts'

const docsDir = fileURLToPath(new URL('..', import.meta.url))
const FENCE = /^```(yaml|json)\s+\[([^\]]+)\]\n([\s\S]*?)^```/gm

interface Project {
  page: string
  files: Map<string, string>
}

async function pages(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['public', 'scripts', 'AGENTS.md'].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await pages(full)))
    else if (entry.name.endsWith('.md')) out.push(full)
  }
  return out.sort()
}

function projectsOf(page: string, markdown: string): Project[] {
  const projects: Project[] = []
  let current: Project | undefined
  for (const [, , name, body] of markdown.matchAll(FENCE)) {
    const file = name!.trim()
    if (!current || current.files.has(file)) {
      current = { page, files: new Map() }
      projects.push(current)
    }
    current.files.set(file, body!)
  }
  return projects
}

/** Relative image paths used as icons or backgrounds, to create placeholders for. */
function iconFiles(text: string): string[] {
  const pattern = new RegExp(`["']?(?:icon|image)["']?\\s*:\\s*["']?([^\\s"',}]+(?:${ICON_EXTENSIONS.map((e) => `\\${e}`).join('|')}))`, 'gi')
  return [...text.matchAll(pattern)].map((match) => match[1]!)
}

async function check(project: Project): Promise<string[]> {
  const dir = await mkdtemp(path.join(tmpdir(), 'na-docs-'))
  try {
    const [root] = project.files.keys()
    for (const [name, body] of project.files) {
      const file = path.join(dir, name)
      await mkdir(path.dirname(file), { recursive: true })
      await writeFile(file, body)
      for (const icon of iconFiles(body)) {
        const image = path.resolve(path.dirname(file), icon)
        await mkdir(path.dirname(image), { recursive: true })
        await writeFile(image, '<svg xmlns="http://www.w3.org/2000/svg"/>')
      }
    }
    const problems: string[] = []
    const read = new Set<string>()
    const posix = (name: string) => path.normalize(name).split(path.sep).join('/')
    for (const name of [root!, ...project.files.keys()]) {
      if (read.has(posix(name))) continue
      const result = await loadArchitecture(path.join(dir, name), { projectRoot: dir })
      for (const file of result.files) read.add(posix(path.relative(dir, file)))
      if (!result.ok) {
        problems.push(...result.errors.map(formatConfigError))
        continue
      }
      // Every named icon must exist. Iconify and Dashboard Icons are downloaded: without network
      // (or offline) they are skipped (reported), not failed.
      for (const warning of (await buildViewerData(result.architecture)).warnings) {
        if (warning.message.includes('download failed') || warning.message.includes('not in the icon cache')) skipped.add(warning.message)
        else problems.push(formatConfigError(warning))
      }
    }
    return [...new Set(problems)]
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

let failures = 0
let checked = 0
const skipped = new Set<string>()
for (const page of await pages(docsDir)) {
  const relative = path.relative(docsDir, page)
  for (const project of projectsOf(relative, await readFile(page, 'utf8'))) {
    checked++
    const problems = await check(project)
    const files = [...project.files.keys()].join(', ')
    if (problems.length === 0) continue
    failures++
    console.error(`✗ ${relative} (${files})`)
    for (const problem of problems) console.error(`    ${problem}`)
  }
}
for (const message of skipped) console.warn(`skipped (offline?): ${message}`)
console.log(`${checked - failures}/${checked} documentation examples valid`)
process.exitCode = failures > 0 ? 1 : 0
