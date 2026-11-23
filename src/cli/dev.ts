// Local dev server: serves the precompiled viewer and the current data on 127.0.0.1, watches the
// configuration and icon files, and tells open viewers to reload (server-sent events).
// A configuration error never stops the server: it is reported, and served to the viewer.
import { watch, type FSWatcher } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import path from 'node:path'
import {
  buildViewerData,
  ICON_EXTENSIONS,
  ICONS_DIR,
  loadArchitecture,
  type ConfigError,
  type IconProvider,
  type ViewerBundle,
} from '../core/index.ts'
import { DATA_FILE, EVENTS_PATH, FILES_DIR, LIVE_META, contentType, localFiles, summary } from './site.ts'

export interface DevServerOptions {
  file: string
  projectRoot: string
  viewerDir: string
  /** 0 picks a free port. */
  port: number
  /** When the port is taken, try the next ones (for the default port only). */
  portAttempts?: number
  log?: DevLogger
  /** Default: `defaultIconProviders()`. */
  iconProviders?: IconProvider[]
}

export interface DevLogger {
  info(line: string): void
  warn(line: string): void
  warnings(warnings: ConfigError[]): void
  errors(errors: ConfigError[]): void
}

export interface DevServer {
  url: string
  /** Resolves once the data has been reloaded (after a file change), for tests. */
  reloaded(): Promise<void>
  close(): Promise<void>
}

const HOST = '127.0.0.1'
/**
 * Cloudflare quick tunnels (`cloudflared tunnel --url http://127.0.0.1:<port>`) forward requests
 * with their own public name. Its DNS belongs to Cloudflare: it cannot be pointed at 127.0.0.1, so
 * accepting it keeps the DNS rebinding protection.
 */
const TUNNEL_HOST = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.trycloudflare\.com$/i
const DEBOUNCE_MS = 80
const WATCHED_EXTENSIONS = new Set(['.yml', '.yaml', '.json', ...ICON_EXTENSIONS])
const SECURITY_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }

type State = { ok: true; bundle: ViewerBundle; icons: Set<string> } | { ok: false; errors: ConfigError[] }

export async function startDevServer(options: DevServerOptions): Promise<DevServer> {
  const { file, projectRoot, viewerDir } = options
  const log = options.log ?? silentLogger
  const clients = new Set<ServerResponse>()
  const watchers = new Map<string, FSWatcher>()
  let state: State = { ok: false, errors: [] }
  let indexHtml = ''
  let reloadWaiters: (() => void)[] = []

  async function reload(): Promise<void> {
    const result = await loadArchitecture(file, { projectRoot })
    if (result.architecture) {
      // Errors only leave out the elements they concern: the rest is shown, with the errors.
      // New icon references are resolved here, on every reload; known ones come from memory.
      const bundle = await buildViewerData(result.architecture, { ...(options.iconProviders && { providers: options.iconProviders }) })
      if (!result.ok) bundle.data.errors = result.errors
      state = { ok: true, bundle, icons: new Set(localFiles(result.architecture)) }
      if (result.ok) log.info(`✓ ${summary(result.architecture)}`)
      else log.errors(result.errors)
      log.warnings(bundle.warnings)
    } else {
      state = { ok: false, errors: result.errors }
      log.errors(result.errors)
    }
    // Watch the directories of every file involved (and of the root file, even if missing):
    // this also catches editors that save by replacing the file, and files being created.
    updateWatchers(new Set([path.dirname(path.resolve(file)), ...result.files.map((f) => path.dirname(f))]))
  }

  function updateWatchers(dirs: Set<string>): void {
    for (const [dir, watcher] of watchers) {
      if (!dirs.has(dir)) {
        watcher.close()
        watchers.delete(dir)
      }
    }
    for (const dir of dirs) {
      if (watchers.has(dir)) continue
      try {
        const watcher = watch(dir, (_event, name) => {
          if (name === null || WATCHED_EXTENSIONS.has(path.extname(name.toString()).toLowerCase())) scheduleReload()
        })
        watcher.on('error', () => {
          watcher.close()
          watchers.delete(dir)
        })
        watchers.set(dir, watcher)
      } catch {
        // Directory missing or not watchable: picked up again on the next reload.
      }
    }
  }

  // Coalesce bursts of events; never run two reloads at once.
  let timer: NodeJS.Timeout | undefined
  let running: Promise<void> | undefined
  let pending = false
  function scheduleReload(): void {
    clearTimeout(timer)
    timer = setTimeout(runReload, DEBOUNCE_MS)
  }
  async function runReload(): Promise<void> {
    if (running) {
      pending = true
      return
    }
    running = reload().catch((error: Error) => log.warn(`Reload failed: ${error.message}`))
    await running
    running = undefined
    for (const client of clients) client.write('data: reload\n\n')
    const waiters = reloadWaiters
    reloadWaiters = []
    for (const resolve of waiters) resolve()
    if (pending) {
      pending = false
      scheduleReload()
    }
  }

  async function handle(req: IncomingMessage, res: ServerResponse, port: number): Promise<void> {
    // Only answer requests addressed to this local server, or through a Cloudflare quick tunnel
    // (defeats DNS rebinding).
    const host = req.headers.host ?? ''
    if (host !== `${HOST}:${port}` && host !== `localhost:${port}` && !TUNNEL_HOST.test(host)) {
      return send(res, 403, 'text/plain; charset=utf-8', 'Forbidden')
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain; charset=utf-8', 'Method not allowed')

    let pathname: string
    try {
      pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
    } catch {
      return send(res, 400, 'text/plain; charset=utf-8', 'Bad request')
    }

    if (pathname === `/${EVENTS_PATH}`) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'keep-alive', ...SECURITY_HEADERS })
      res.write(': connected\n\n')
      clients.add(res)
      req.on('close', () => clients.delete(res))
      return
    }
    if (pathname === `/${DATA_FILE}`) {
      return state.ok
        ? send(res, 200, contentType(DATA_FILE), JSON.stringify(state.bundle.data))
        : send(res, 422, contentType(DATA_FILE), JSON.stringify({ errors: state.errors }))
    }
    if (pathname.startsWith(`/${ICONS_DIR}/`)) {
      // Icons of collections (validated SVG), attributions and licenses: generated, in memory.
      const file = pathname.slice(1)
      const content = state.ok && Object.hasOwn(state.bundle.files, file) ? state.bundle.files[file] : undefined
      if (content === undefined) return send(res, 404, 'text/plain; charset=utf-8', 'Not found')
      res
        .writeHead(200, {
          'Content-Type': contentType(file),
          ...SECURITY_HEADERS,
          'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
        })
        .end(content)
      return
    }
    if (pathname.startsWith(`/${FILES_DIR}/`)) {
      // Only the icon files referenced by the current (validated, confined) architecture.
      const icon = pathname.slice(FILES_DIR.length + 2)
      if (!state.ok || !state.icons.has(icon)) return send(res, 404, 'text/plain; charset=utf-8', 'Not found')
      return sendFile(res, path.join(projectRoot, icon), {
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      })
    }
    if (pathname === '/' || pathname === '/index.html') return send(res, 200, contentType('index.html'), indexHtml)
    // Viewer assets, confined to the viewer directory.
    const asset = path.resolve(viewerDir, `.${pathname}`)
    if (!asset.startsWith(path.resolve(viewerDir) + path.sep)) return send(res, 404, 'text/plain; charset=utf-8', 'Not found')
    return sendFile(res, asset)
  }

  indexHtml = (await readFile(path.join(viewerDir, 'index.html'), 'utf8')).replace('</head>', `  ${LIVE_META}\n  </head>`)
  await reload()

  let boundPort = 0
  const { server, port } = await listen(
    (req, res) =>
      void handle(req, res, boundPort).catch(() => {
        if (!res.headersSent) send(res, 500, 'text/plain; charset=utf-8', 'Server error')
        else res.end()
      }),
    options.port,
    options.portAttempts ?? 1,
  )
  boundPort = port
  const heartbeat = setInterval(() => {
    for (const client of clients) client.write(': ping\n\n')
  }, 30_000)

  return {
    url: `http://${HOST}:${port}/`,
    reloaded: () => new Promise((resolve) => reloadWaiters.push(resolve)),
    close: async () => {
      clearInterval(heartbeat)
      clearTimeout(timer)
      for (const watcher of watchers.values()) watcher.close()
      for (const client of clients) client.end()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }
}

const silentLogger: DevLogger = { info() {}, warn() {}, warnings() {}, errors() {} }

function send(res: ServerResponse, status: number, type: string, body: string): void {
  res.writeHead(status, { 'Content-Type': type, ...SECURITY_HEADERS }).end(body)
}

async function sendFile(res: ServerResponse, file: string, headers: Record<string, string> = {}): Promise<void> {
  let body: Buffer
  try {
    body = await readFile(file)
  } catch {
    return send(res, 404, 'text/plain; charset=utf-8', 'Not found')
  }
  res.writeHead(200, { 'Content-Type': contentType(file), ...SECURITY_HEADERS, ...headers }).end(body)
}

async function listen(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
  port: number,
  attempts: number,
): Promise<{ server: Server; port: number }> {
  for (let attempt = 0; ; attempt++) {
    const server = createServer(handler)
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(port === 0 ? 0 : port + attempt, HOST, () => resolve())
      })
      const address = server.address()
      return { server, port: typeof address === 'object' && address ? address.port : port }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE' || attempt + 1 >= attempts) {
        if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
          throw new Error(`Port ${port + attempt} is already in use. Choose another one with --port.`)
        }
        throw error
      }
    }
  }
}
