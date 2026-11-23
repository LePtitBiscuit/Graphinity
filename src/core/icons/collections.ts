// The icon collections with a dedicated provider (no heavy imports). Any other `prefix:name` is
// an Iconify collection, resolved through the Iconify API.

export interface Collection {
  prefix: string
  name: string
}

/** Collections with their own provider, in reference order. A name without prefix is a Simple Icons name. */
export const ICON_COLLECTIONS: readonly Collection[] = [
  { prefix: 'simple-icons', name: 'Simple Icons' },
  { prefix: 'devicon', name: 'Devicon' },
  { prefix: 'logos', name: 'SVG Logos' },
  { prefix: 'vscode-icons', name: 'VSCode Icons' },
  { prefix: 'dashboard', name: 'Dashboard Icons' },
]

export const DEFAULT_COLLECTION = 'simple-icons'

/** `logos:react` → `{ prefix: 'logos', name: 'react' }`; `github` → Simple Icons. */
export function parseIconName(reference: string): { prefix: string; name: string } {
  const colon = reference.indexOf(':')
  if (colon === -1) return { prefix: DEFAULT_COLLECTION, name: reference }
  return { prefix: reference.slice(0, colon).toLowerCase(), name: reference.slice(colon + 1) }
}

/** Collection names in messages: "SVG Logos", or "Iconify mdi". */
export function collectionName(prefix: string): string {
  return ICON_COLLECTIONS.find((c) => c.prefix === prefix)?.name ?? `Iconify ${prefix}`
}
