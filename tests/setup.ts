// No test downloads anything: icons come from an empty, per-run cache, and the providers that
// download (Iconify API, Dashboard Icons) are offline unless a test passes its own `fetch`.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

process.env.XDG_CACHE_HOME = mkdtempSync(path.join(tmpdir(), 'graphinity-cache-'))
process.env.GRAPHINITY_OFFLINE = '1'
