import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { contentType } from './src/cli/site.ts'
import { localFiles } from './src/cli/site.ts'
import { buildViewerData, loadArchitecture } from './src/core/index.ts'

// `pnpm dev:viewer` (and `pnpm dev`) listen on GRAPHINITY_PORT when it is set (an error if the
// port is taken, like `graphinity dev --port`), otherwise from 5173 upward.
const port = devPort(process.env.GRAPHINITY_PORT)

// Builds the Vue viewer into dist/viewer so it ships precompiled inside the npm package.
export default defineConfig({
  root: fileURLToPath(new URL('./viewer', import.meta.url)),
  // Relative asset URLs: the bundle must work from any directory or static host path.
  base: './',
  plugins: [vue(), devData(), contentSecurityPolicy()],
  server: {
    // `pnpm dev:viewer` through a Cloudflare quick tunnel (cloudflared tunnel --url http://localhost:5173).
    allowedHosts: ['.trycloudflare.com'],
    ...(port === undefined ? {} : { port, strictPort: true }),
  },
  build: {
    outDir: fileURLToPath(new URL('./dist/viewer', import.meta.url)),
    emptyOutDir: true,
    // ELK (the layout engine, ~1.4 MB) is a single chunk that cannot be split further.
    chunkSizeWarningLimit: 1600,
  },
})

function devPort(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid GRAPHINITY_PORT "${value}": expected a port from 1 to 65535.`)
  return port
}

/**
 * Production build only (Vite's dev server injects inline scripts): the viewer loads nothing
 * but its own files. Inline styles are needed by Vue Flow; `data:` images by its controls.
 */
function contentSecurityPolicy(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')
  return {
    name: 'graphinity:csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' },
    ],
  }
}

/**
 * `pnpm dev:viewer` (and `pnpm dev`) only: serves `architecture.json` and the local icon files of an example
 * (GRAPHINITY_FILE, Kestrel Logistics by default), reloaded on every request.
 */
function devData(): Plugin {
  const file = path.resolve(process.env.GRAPHINITY_FILE ?? 'examples/kestrel/architecture.yml')
  const projectRoot = path.dirname(file)

  return {
    name: 'graphinity:dev-data',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const { pathname } = new URL(req.url ?? '/', 'http://localhost')
        if (pathname !== '/architecture.json' && !pathname.startsWith('/files/') && !pathname.startsWith('/icons/')) return next()
        try {
          const result = await loadArchitecture(file)
          if (!result.architecture) {
            res.writeHead(422, { 'Content-Type': 'application/json' }).end(JSON.stringify({ errors: result.errors }))
            return
          }
          const architecture = result.architecture
          const bundle = await buildViewerData(architecture)
          if (!result.ok) bundle.data.errors = result.errors
          if (pathname === '/architecture.json') {
            res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(bundle.data))
            return
          }
          if (pathname.startsWith('/icons/')) {
            const content = bundle.files[pathname.slice(1)]
            if (content === undefined) return void res.writeHead(404).end()
            res.writeHead(200, { 'Content-Type': contentType(pathname), 'X-Content-Type-Options': 'nosniff' }).end(content)
            return
          }
          // Only local images referenced by the (validated, confined) architecture are served.
          const requested = decodeURIComponent(pathname.slice('/files/'.length))
          const allowed = localFiles(architecture).includes(requested)
          if (!allowed) {
            res.writeHead(404).end()
            return
          }
          res
            .writeHead(200, {
              'Content-Type': contentType(requested),
              'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
              'X-Content-Type-Options': 'nosniff',
            })
            .end(await readFile(path.join(projectRoot, requested)))
        } catch (error) {
          next(error)
        }
      })
    },
  }
}
