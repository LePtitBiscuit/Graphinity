// The interface every icon collection implements. A provider turns an icon name into icon data,
// once; it never touches the viewer. Add a collection by implementing it (see index.ts).

export interface Attribution {
  /** Collection name, e.g. "SVG Logos". */
  collection: string
  author?: string
  /** SPDX identifier, e.g. "MIT". */
  license: string
  licenseUrl: string
  /** Where the icons come from. */
  source: string
  /** Name of the license text in `licenses/`, when redistribution requires shipping it. */
  licenseFile?: string
}

export type ProvidedIcon =
  /** A single-color logo as SVG path data, drawn in its brand color (Simple Icons). */
  | { type: 'brand'; title: string; hex: string; path: string }
  /** A complete SVG document, written as a file of the site. */
  | { type: 'svg'; title: string; svg: string }

export type ResolveResult =
  /** `attribution`: the collection credited for this icon, when it differs from the provider's. */
  | { found: true; icon: ProvidedIcon; attribution?: Attribution }
  | { found: false; reason: string }

/** Prefix of the provider that handles every prefix without a provider of its own. */
export const ANY_PREFIX = '*'

export interface IconProvider {
  /**
   * Prefix of `prefix:name` icon references, e.g. "logos". `*` (`ANY_PREFIX`): every prefix that
   * no other provider handles (the universal Iconify provider).
   */
  readonly prefix: string
  /** Credited for every icon it resolves (unless a result has its own `attribution`). */
  readonly attribution?: Attribution
  /** Never throws: problems are returned as `{ found: false, reason }`. */
  /** `prefix`: the (lowercase) prefix of the reference; needed by the `*` provider only. */
  resolve(name: string, prefix?: string): Promise<ResolveResult>
  /**
   * Optional: resolves several names of one prefix at once (one request instead of many).
   * Returns one result per name, in order. Never throws.
   */
  resolveMany?(names: string[], prefix: string): Promise<ResolveResult[]>
}

/** Icon names: lowercase words separated by hyphens (Iconify and Dashboard Icons conventions). */
export const KEBAB_NAME = /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/

/** Iconify prefixes and icon names: lowercase letters and digits, separated by single hyphens. */
export const ICONIFY_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
