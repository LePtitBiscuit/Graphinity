// Terminal branding: the Graphinity logo, its colors, and when to use them.
//
// The logo is the official one (docs/public/logo.svg: an open hexagon "G" with three nodes,
// repeated at three nested scales), rasterized into Braille characters. Its gradient goes from
// violet at the bottom left to pink at the top right, like the SVG's.
import { readFileSync } from 'node:fs'

/** `NO_COLOR` always wins; `FORCE_COLOR` styles output that is not a terminal (e.g. CI logs). */
export function colorEnabled(stream: { isTTY?: boolean }): boolean {
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') return false
  const force = process.env.FORCE_COLOR
  if (force !== undefined && force !== '' && force !== '0' && force !== 'false') return true
  return Boolean(stream.isTTY) && process.env.TERM !== 'dumb'
}

/** The large logo is for people at a terminal: never in pipes, logs or CI (unless forced). */
export function showLogo(stream: { isTTY?: boolean }): boolean {
  const force = process.env.FORCE_COLOR
  return Boolean(stream.isTTY) || (force !== undefined && force !== '' && force !== '0' && force !== 'false')
}

interface PackageJson {
  homepage?: string
}

// From src/cli (sources) and dist/cli (published) alike.
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as PackageJson

/** The documentation site (package.json `homepage`), with a trailing slash; `undefined` if unset. */
export const DOCS_URL: string | undefined = pkg.homepage ? pkg.homepage.replace(/\/?$/, '/') : undefined

/** A page of the documentation, e.g. `docsUrl('cli/init')`. */
export function docsUrl(page = ''): string | undefined {
  return DOCS_URL && `${DOCS_URL}${page}`
}

export const TAGLINE = 'Interactive nested architecture diagrams'

export const LOGO: readonly string[] = [
  '         ⣠⣶⣶⣄        ',
  '     ⢀⣠⣴⣾⠿⠛⠛⠿⣷⣦⣄⡀    ',
  '  ⢀⣤⣶⡿⠟⠋      ⠙⠻⢿⣶⣤⡀ ',
  '  ⣿⣿⠉   ⢀⣠⣶⣶⣄⡀   ⠉⠛⠛ ',
  '  ⣿⣿   ⣾⡿⢟⣭⣭⡻⢿⣷   ⢀⡀ ',
  '  ⣿⣿   ⣿⡇⣿⣏⣿⣿⣿⣿⣿⣿⣿⣿⣿⠆',
  '  ⣿⣿   ⢿⣷⣮⣛⣛⣵⣾⡿   ⣿⣿ ',
  ' ⣰⣿⣿⣆   ⠈⠙⠿⠿⠋⠁   ⣀⣿⣿ ',
  ' ⠘⠻⠟⠿⣷⣦⣄      ⣠⣴⣾⠿⠛⠁ ',
  '     ⠈⠙⠻⢿⣶⣤⣤⣶⡿⠟⠋⠁    ',
  '         ⠉⠛⠛⠉        ',
]

type Rgb = [number, number, number]

/** The stops of the logo's gradient (docs/public/logo.svg). */
const STOPS: readonly [number, Rgb][] = [
  [0, [0x6d, 0x28, 0xd9]],
  [0.4, [0xa8, 0x55, 0xf7]],
  [0.72, [0xd9, 0x46, 0xef]],
  [1, [0xf4, 0x72, 0xb6]],
]

function gradientAt(t: number): Rgb {
  const at = Math.min(1, Math.max(0, t))
  for (let i = 1; i < STOPS.length; i++) {
    const [end, to] = STOPS[i]!
    const [start, from] = STOPS[i - 1]!
    if (at <= end) {
      const k = (at - start) / (end - start)
      return [0, 1, 2].map((c) => Math.round(from[c]! + (to[c]! - from[c]!) * k)) as Rgb
    }
  }
  return STOPS[STOPS.length - 1]![1]
}

/** 24-bit color where the terminal says it supports it, the nearest of the 256 colors otherwise. */
function foreground([r, g, b]: Rgb): string {
  if (/^(truecolor|24bit)$/i.test(process.env.COLORTERM ?? '')) return `\x1b[38;2;${r};${g};${b}m`
  const level = (v: number) => (v < 48 ? 0 : v < 115 ? 1 : Math.min(5, Math.floor((v - 35) / 40)))
  return `\x1b[38;5;${16 + 36 * level(r) + 6 * level(g) + level(b)}m`
}

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'

/** Styles for one output stream: plain text when colors are off. */
export function styles(stream: { isTTY?: boolean }) {
  const on = colorEnabled(stream)
  const wrap = (open: string) => (text: string) => (on ? `${open}${text}${RESET}` : text)
  return {
    on,
    bold: wrap(BOLD),
    dim: wrap('\x1b[2m'),
    green: wrap('\x1b[32m'),
    red: wrap('\x1b[31m'),
    yellow: wrap('\x1b[33m'),
    /** The violet of the logo, for headings. */
    accent: (text: string) => (on ? `${foreground(STOPS[1]![1])}${text}${RESET}` : text),
    /** The pink of the logo, for commands and links. */
    link: (text: string) => (on ? `${foreground(STOPS[3]![1])}${text}${RESET}` : text),
    /** The gradient of the logo across a text (the product name). */
    gradient: (text: string) => {
      if (!on) return text
      const chars = [...text]
      return chars.map((char, i) => `${foreground(gradientAt(i / Math.max(1, chars.length - 1)))}${char}`).join('') + RESET
    },
    /** The logo, colored diagonally from the bottom left to the top right. */
    logo: (): string[] =>
      LOGO.map((line, row) => {
        if (!on) return line
        const chars = [...line]
        return (
          chars
            .map((char, col) => {
              if (char === ' ') return char
              const t = (col / (chars.length - 1) + (1 - row / (LOGO.length - 1))) / 2
              return `${foreground(gradientAt(t))}${char}`
            })
            .join('') + RESET
        )
      }),
  }
}

export type Styles = ReturnType<typeof styles>

/** The logo with lines of text beside it, vertically centered. */
export function besideLogo(s: Styles, lines: readonly string[]): string {
  const logo = s.logo()
  const top = Math.max(0, Math.floor((logo.length - lines.length) / 2))
  return logo.map((row, i) => `  ${row}   ${lines[i - top] ?? ''}`.trimEnd()).join('\n')
}
