// Writes every logo file from brand/logo.html (the single source of the drawing): brand/svg,
// brand/png, the documentation site's logo and favicon, and the viewer's favicon.
// Usage: pnpm brand (Google Chrome, as for the end-to-end tests; set CHROME_PATH if it is elsewhere).
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'

type Options = { variant: 'mark' | 'horizontal' | 'stacked' | 'favicon'; bg?: 'transparent' | 'dark' | 'light'; text?: 'light' | 'dark' }

const root = fileURLToPath(new URL('..', import.meta.url))

const SVG: Record<string, Options> = {
  'graphinity-mark.svg': { variant: 'mark' },
  'graphinity-favicon.svg': { variant: 'favicon' },
  'graphinity-horizontal-light-text.svg': { variant: 'horizontal', text: 'light' },
  'graphinity-horizontal-dark-text.svg': { variant: 'horizontal', text: 'dark' },
  'graphinity-stacked-light-text.svg': { variant: 'stacked', text: 'light' },
  'graphinity-stacked-dark-text.svg': { variant: 'stacked', text: 'dark' },
}

const PNG: [string, Options, number][] = [
  ['graphinity-mark-256.png', { variant: 'mark' }, 256],
  ['graphinity-mark-512.png', { variant: 'mark' }, 512],
  ['graphinity-mark-1024.png', { variant: 'mark' }, 1024],
  ['graphinity-mark-dark-bg-512.png', { variant: 'mark', bg: 'dark' }, 512],
  ['graphinity-horizontal-light-text-1200.png', { variant: 'horizontal', text: 'light' }, 1200],
  ['graphinity-horizontal-dark-text-1200.png', { variant: 'horizontal', text: 'dark' }, 1200],
  ['graphinity-horizontal-dark-bg-1200.png', { variant: 'horizontal', bg: 'dark', text: 'light' }, 1200],
  ['graphinity-stacked-light-text-800.png', { variant: 'stacked', text: 'light' }, 800],
  ['graphinity-stacked-dark-text-800.png', { variant: 'stacked', text: 'dark' }, 800],
  ['graphinity-favicon-16.png', { variant: 'favicon' }, 16],
  ['graphinity-favicon-32.png', { variant: 'favicon' }, 32],
  ['graphinity-favicon-48.png', { variant: 'favicon' }, 48],
  ['graphinity-favicon-180-dark-bg.png', { variant: 'favicon', bg: 'dark' }, 180],
  ['graphinity-favicon-512.png', { variant: 'favicon' }, 512],
]

// Copies used by the documentation site and the viewer.
const COPIES: Record<string, string> = {
  'docs/public/logo.svg': 'graphinity-mark.svg',
  'docs/public/favicon.svg': 'graphinity-favicon.svg',
  'viewer/public/favicon.svg': 'graphinity-favicon.svg',
}

// The Google Chrome of the end-to-end tests, or CHROME_PATH (e.g. /usr/bin/google-chrome).
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' })
try {
  const page = await browser.newPage()
  await page.goto(pathToFileURL(`${root}brand/logo.html`).href)
  await mkdir(`${root}brand/svg`, { recursive: true })
  await mkdir(`${root}brand/png`, { recursive: true })
  await mkdir(`${root}viewer/public`, { recursive: true })

  const svgs: Record<string, string> = {}
  for (const [name, options] of Object.entries(SVG)) {
    svgs[name] = `${await page.evaluate((o) => (globalThis as any).graphinityLogo.logo(o), options)}\n`
    await writeFile(`${root}brand/svg/${name}`, svgs[name])
  }
  for (const [name, options, width] of PNG) {
    const base64 = await page.evaluate(async ([o, w]) => {
      const { logo, png } = (globalThis as any).graphinityLogo
      const blob: Blob = await png(logo(o), w)
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      return btoa(binary)
    }, [options, width] as const)
    await writeFile(`${root}brand/png/${name}`, Buffer.from(base64, 'base64'))
  }
  for (const [target, source] of Object.entries(COPIES)) await writeFile(`${root}${target}`, svgs[source] ?? '')
  console.log(`${Object.keys(SVG).length} SVG, ${PNG.length} PNG, ${Object.keys(COPIES).length} copies written.`)
} finally {
  await browser.close()
}
