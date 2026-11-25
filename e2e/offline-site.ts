// Builds a site that uses Iconify icons, without network (from a prepared icon cache, offline
// mode), and serves it as plain static files: the e2e test checks that it works offline.
// Usage: node e2e/offline-site.ts <port>
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'

const port = Number(process.argv[2])
const root = await mkdtemp(path.join(tmpdir(), 'graphinity-offline-'))

// A cache as a previous build would have left it.
const cache = path.join(root, 'cache')
process.env.XDG_CACHE_HOME = cache
process.env.GRAPHINITY_OFFLINE = '1'
const icon = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" color="#e6e9ef">${body}</svg>`
const seed: Record<string, string> = {
  'mdi/database.svg': icon('<path fill="currentColor" d="M12 3C7.58 3 4 4.79 4 7s3.58 4 8 4s8-1.79 8-4s-3.58-4-8-4"/>'),
  'mdi/collection.json': JSON.stringify({ name: 'Material Design Icons', author: { name: 'Pictogrammers' }, license: { spdx: 'Apache-2.0' } }),
  'tabler/server.svg': icon('<path fill="none" stroke="currentColor" stroke-width="2" d="M3 7h18M3 15h18"/>'),
  'tabler/collection.json': JSON.stringify({ name: 'Tabler Icons', license: { spdx: 'MIT' } }),
}
for (const [file, content] of Object.entries(seed)) {
  await mkdir(path.dirname(path.join(cache, 'graphinity', 'iconify', file)), { recursive: true })
  await writeFile(path.join(cache, 'graphinity', 'iconify', file), content)
}

const projectDir = path.join(root, 'project')
await mkdir(path.join(projectDir, 'images'), { recursive: true })
await mkdir(path.join(projectDir, 'icons'), { recursive: true })
// Local images as icons: an SVG, and a PNG (a 1×1 pixel).
await writeFile(path.join(projectDir, 'icons', 'team.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#4f8cff"/></svg>')
await writeFile(
  path.join(projectDir, 'icons', 'badge.png'),
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
)
await writeFile(
  path.join(projectDir, 'images', 'bg.svg'),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#123"/></svg>',
)
await writeFile(
  path.join(projectDir, 'architecture.yml'),
  [
    'id: offline',
    'name: Offline',
    'background: { image: images/bg.svg, blur: 4 }',
    'groups:',
    '  - { id: cloud, name: Cloud, background: none }',
    '  - { id: data, name: Data, color: "#2fb8ac", blur: 10, group: cloud }',
    'nodes:',
    '  - { id: db, name: Database, icon: mdi:database, group: data }',
    '  - { id: server, name: Server, icon: tabler:server, size: large, background: "#3fb95026" }',
    '  - { id: repo, name: Repository, icon: github, size: small }',
    '  - { id: cluster, name: Cluster, icon: mdi:database, universe: cluster.yml }',
    '  - { id: team, name: Team, icon: ./icons/team.svg, size: small }',
    '  - { id: badge, name: Badge, icon: ./icons/badge.png, size: small }',
    'connections:',
    '  - { from: { node: server, side: top }, to: db }',
    '  - { from: repo, to: cluster/worker, label: deploy }',
    // A connection to a group (its frame).
    '  - { from: badge, to: data, label: sync }',
    // A path that ends on a group of a sub-universe.
    '  - { from: team, to: cluster/pool, label: jobs }',
    '',
  ].join('\n'),
)

await writeFile(
  path.join(projectDir, 'cluster.yml'),
  [
    'id: cluster',
    'name: Cluster',
    'background: { grid: "#ff000080" }',
    'groups:',
    '  - { id: pool, name: Pool }',
    'nodes:',
    '  - { id: worker, name: Worker, icon: tabler:server }',
    '  - { id: cache, name: Cache, icon: mdi:database }',
    '  - { id: queue, name: Queue, icon: mdi:database, group: pool }',
    'connections:',
    // Side by side: the cache stays in the column of the worker.
    '  - { from: worker, to: cache, label: warm, align: true }',
    '',
  ].join('\n'),
)

const { buildSite } = await import('../src/cli/build.ts')
const { contentType, viewerDir } = await import('../src/cli/site.ts')
const outDir = path.join(root, 'site')
const result = await buildSite({ file: path.join(projectDir, 'architecture.yml'), projectRoot: projectDir, outDir, viewerDir: viewerDir() })
if (!result.ok) throw new Error(`build failed: ${JSON.stringify(result)}`)
if (result.bundle.warnings.length > 0) throw new Error(`unexpected warnings: ${JSON.stringify(result.bundle.warnings)}`)

createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
  const file = path.join(outDir, pathname.endsWith('/') ? `${pathname}index.html` : pathname)
  if (!file.startsWith(outDir)) return res.writeHead(403).end()
  try {
    const content = await readFile(file)
    res.writeHead(200, { 'content-type': contentType(file) }).end(content)
  } catch {
    res.writeHead(404).end()
  }
}).listen(port, '127.0.0.1')
