// Brand colors are designed for light backgrounds; very dark ones (e.g. GitHub's #181717)
// would vanish on the dark canvas, so they are replaced with a light neutral.

const CARD_BACKGROUND = '#161a22'
const FALLBACK = '#e6e9ef'
const MIN_CONTRAST = 2.5

export function readableBrandColor(hex: string): string {
  const color = `#${hex}`
  return /^[0-9a-f]{6}$/i.test(hex) && contrast(color, CARD_BACKGROUND) >= MIN_CONTRAST ? color : FALLBACK
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** WCAG relative luminance of a `#rrggbb` color. */
function luminance(color: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(color.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}
