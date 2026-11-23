import { readFileSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vitepress'
import { buildLlmFiles, writeLlmFiles } from '../scripts/llms.ts'
import { sidebar } from './sidebar.ts'

// Set DOCS_BASE (e.g. "/Graphinity/") to host the site under a sub-path. The GitHub Pages workflow
// sets it from the Pages settings ("/" with a custom domain).
const base = process.env.DOCS_BASE ?? '/'
const repository = 'https://github.com/LePtitBiscuit/Graphinity'
/** Cloudflare quick tunnels (`<name>.trycloudflare.com`), besides localhost. */
const TUNNEL_HOSTS = ['.trycloudflare.com']
const description = 'Interactive, recursive architecture diagrams from YAML and JSON files.'

// Absolute URL of the published site, for the links of llms.txt and the Markdown pages. The GitHub
// Pages workflow sets DOCS_URL from the Pages settings; otherwise the package's homepage.
const homepage = (JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { homepage?: string }).homepage
const siteUrl = (process.env.DOCS_URL || homepage || base).replace(/\/?$/, '/')
const docsDir = fileURLToPath(new URL('..', import.meta.url))

const demoDir = path.join(docsDir, 'public', 'demo')
const DEMO_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

/**
 * `pnpm dev:docs`: serves the live demo (docs/public/demo, built by `pnpm docs:demo`) from the
 * disk. Vite would not serve `/demo/` (a folder) as `demo/index.html`, and keeps the list of public
 * files it found at startup: a demo rebuilt while the server runs would give 404s.
 */
function liveDemo(): Plugin {
  return {
    name: 'graphinity:live-demo',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
        if (pathname === `${base}demo`) return res.writeHead(301, { Location: `${base}demo/` }).end()
        if (!pathname.startsWith(`${base}demo/`)) return next()
        const relative = pathname.slice(`${base}demo`.length).replace(/^\//, '')
        const file = path.resolve(demoDir, relative === '' || relative.endsWith('/') ? `${relative}index.html` : relative)
        if (file !== demoDir && !file.startsWith(demoDir + path.sep)) return res.writeHead(403).end()
        try {
          if (!(await stat(file)).isFile()) throw new Error('not a file')
          res.writeHead(200, { 'Content-Type': DEMO_TYPES[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
          res.end(await readFile(file))
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('The live demo is not built: run "pnpm docs:demo".')
        }
      })
    },
  }
}

/**
 * `pnpm dev:docs`: serves llms.txt, llms-full.txt and the Markdown version of each page, as the
 * built site does. Requests of the page modules themselves (scripts) are left to VitePress.
 */
function llmFiles(): Plugin {
  return {
    name: 'graphinity:llm-files',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const { pathname, search } = new URL(req.url ?? '/', 'http://localhost')
        const relative = decodeURIComponent(pathname).slice(base.length)
        if (search || req.headers['sec-fetch-dest'] === 'script' || !/(\.md|^llms(-full)?\.txt)$/.test(relative)) return next()
        const { files } = await buildLlmFiles(docsDir, siteUrl, description)
        const content = files.get(relative)
        if (content === undefined) return next()
        res.writeHead(200, { 'Content-Type': `${relative.endsWith('.md') ? 'text/markdown' : 'text/plain'}; charset=utf-8` }).end(content)
      })
    },
  }
}


export default defineConfig({
  base,
  lang: 'en-US',
  title: 'Graphinity',
  description,
  cleanUrls: true,
  // Contributor notes and tooling, not pages.
  // public/ holds static files (the generated demo and its ATTRIBUTIONS.md), not pages.
  srcExclude: ['AGENTS.md', 'scripts/**', 'public/**'],
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }],
    ['meta', { name: 'theme-color', content: '#7c3aed' }],
  ],
  // LLM-friendly files (docs/scripts/llms.ts), written into the built site.
  async buildEnd(site) {
    await writeLlmFiles(site.outDir, await buildLlmFiles(docsDir, siteUrl, description))
  },
  vite: {
    plugins: [liveDemo(), llmFiles()],
    // `pnpm dev:docs` through a Cloudflare quick tunnel (cloudflared tunnel --url
    // http://localhost:5173): Vite's dev server only answers known hosts. (`vitepress preview`
    // has its own static server, which answers any host.)
    server: { allowedHosts: TUNNEL_HOSTS },
  },
  markdown: {
    theme: { light: 'github-light', dark: 'github-dark' },
  },
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/what-is-graphinity', activeMatch: '^/(guide|concepts|guides)/' },
      { text: 'Configuration', link: '/config/', activeMatch: '^/config/' },
      { text: 'CLI', link: '/cli/', activeMatch: '^/cli/' },
      { text: 'Reference', link: '/reference/engine', activeMatch: '^/reference/' },
      { text: 'Demo', link: '/guide/demo' },
      { text: 'Contributing', link: '/project/contributing', activeMatch: '^/project/' },
    ],
    socialLinks: [
      { icon: 'github', link: repository },
      { icon: 'npm', link: 'https://www.npmjs.com/package/graphinity' },
    ],
    editLink: {
      pattern: `${repository}/edit/main/docs/:path`,
      text: 'Edit this page on GitHub',
    },
    sidebar,
    search: { provider: 'local' },
    outline: { level: [2, 3] },
    footer: {
      message: 'Released under the Mozilla Public License 2.0. Icons keep the licenses of their collections.',
    },
    docFooter: { prev: 'Previous', next: 'Next' },
  },
})
