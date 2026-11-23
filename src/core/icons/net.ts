// Shared by the providers that download icons (Iconify API, Dashboard Icons): cache location,
// offline mode, request timeouts and a limit on concurrent downloads. Downloads only ever happen
// while a diagram is built (`validate`, `dev`, `build`), never in generated sites.
import { homedir } from 'node:os'
import path from 'node:path'

/** Per request. */
export const DOWNLOAD_TIMEOUT_MS = 10_000
/** Concurrent requests per provider. */
export const MAX_CONCURRENT_DOWNLOADS = 4
/** A failed download is not retried before this delay (the dev server reloads often). */
export const RETRY_AFTER_MS = 30_000

/** `$XDG_CACHE_HOME/graphinity/<name>` (default `~/.cache/graphinity/<name>`). */
export function cacheDirectory(...parts: string[]): string {
  const base = process.env.XDG_CACHE_HOME || path.join(homedir(), '.cache')
  return path.join(base, 'graphinity', ...parts)
}

/** `GRAPHINITY_OFFLINE=1`: icons come from the cache only, nothing is downloaded. */
export function offlineMode(): boolean {
  const value = process.env.GRAPHINITY_OFFLINE
  return value !== undefined && value !== '' && value !== '0' && value.toLowerCase() !== 'false'
}

/** Runs at most `max` tasks at a time; the others wait their turn. */
export function limiter(max: number): <T>(task: () => Promise<T>) => Promise<T> {
  let running = 0
  const queue: (() => void)[] = []
  return async (task) => {
    if (running >= max) await new Promise<void>((resolve) => queue.push(resolve))
    running++
    try {
      return await task()
    } finally {
      running--
      queue.shift()?.()
    }
  }
}

/** A short, single-line description of a fetch failure. */
export function networkReason(error: unknown): string {
  const err = error as Error & { cause?: { code?: string; message?: string } }
  if (err?.name === 'TimeoutError') return 'timed out'
  return err?.cause?.code ? `${err.message} (${err.cause.code})` : (err?.cause?.message ?? err?.message ?? String(error))
}
