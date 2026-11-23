import { defineConfig } from '@playwright/test'

const port = Number(process.env.E2E_PORT ?? 5199)
const offlinePort = Number(process.env.E2E_OFFLINE_PORT ?? 5198)

// End-to-end tests of the precompiled viewer, served by the CLI dev server (Kestrel Logistics), and of
// a built site viewed offline.
// Run through `pnpm test:e2e`, which builds first. Uses the locally installed Google Chrome:
// no Playwright browser download needed.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel: 'chrome',
    viewport: { width: 1400, height: 800 },
  },
  webServer: [
    {
      command: `node src/cli/index.ts dev examples/kestrel/architecture.yml --port ${port} --no-open`,
      url: `http://127.0.0.1:${port}`,
      reuseExistingServer: false,
      // Deterministic: icons missing from the cache are not downloaded.
      env: { GRAPHINITY_OFFLINE: '1' },
    },
    {
      // A site built offline from an icon cache, served as static files (e2e/offline-site.ts).
      command: `node e2e/offline-site.ts ${offlinePort}`,
      url: `http://127.0.0.1:${offlinePort}`,
      reuseExistingServer: false,
    },
  ],
})
