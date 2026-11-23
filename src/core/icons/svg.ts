// Validation of SVG documents: local icon files and icons from collections. The viewer only ever
// displays them through <img> (where scripts never run), but the files are also served by the site
// and could be opened directly: anything that could run code or load external resources is refused.
import { createHash } from 'node:crypto'

export const MAX_SVG_BYTES = 512 * 1024

const FORBIDDEN: [RegExp, string][] = [
  [/<!ENTITY/i, 'declares entities'],
  [/<!DOCTYPE[^>]*\[/i, 'has an internal DOCTYPE subset'],
  [/<\?xml-stylesheet/i, 'references a stylesheet'],
  [/<script[\s>/]/i, 'contains a script'],
  [/<foreignObject[\s>/]/i, 'contains foreign (HTML) content'],
  [/<(iframe|embed|object|audio|video|canvas|html|body|link|meta|base|form|input|button|textarea|handler|listener)[\s>/]/i, 'contains an HTML element'],
  [/<set[\s>/]/i, 'contains a <set> animation'],
  [/<animate\w*[^>]*attributeName\s*=\s*["']?(xlink:)?href/i, 'animates a link'],
  [/\son[a-z]+\s*=/i, 'has an event handler attribute'],
  [/(java|vb)script\s*:/i, 'contains a script URL'],
  [/data\s*:\s*text\/html/i, 'contains an HTML data URL'],
  // Only links inside the document (`#id`) are allowed. The quote is matched explicitly so that
  // the engine cannot backtrack over it.
  [/\b(xlink:)?href\s*=\s*(?:"(?!#)|'(?!#)|(?!["'#]))/i, 'links to an external resource'],
  [/url\(\s*(?:"(?!#)|'(?!#)|(?!["'#\s]))/i, 'references an external resource'],
  [/@import/i, 'imports a stylesheet'],
  [/expression\s*\(/i, 'contains a CSS expression'],
]

/** Why `svg` is not a safe, standalone SVG document; `undefined` when it is. */
export function svgProblem(svg: string): string | undefined {
  if (Buffer.byteLength(svg) > MAX_SVG_BYTES) return `is too large (max ${MAX_SVG_BYTES / 1024} KB)`
  const start = svg
    .replace(/^﻿/, '')
    .replace(/^\s*<\?xml[^>]*\?>/i, '')
    .replace(/^(\s*<!--[\s\S]*?-->)*/, '')
    .replace(/^\s*<!DOCTYPE svg[^>[]*>/i, '')
    .replace(/^(\s*<!--[\s\S]*?-->)*/, '')
    .trimStart()
  for (const [pattern, problem] of FORBIDDEN) if (pattern.test(svg)) return problem
  // A root <svg> element, closed (`</svg>`) or empty (`<svg … />`).
  if (!/^<svg[\s>/]/i.test(start) || !/(<\/svg>|^<svg[^>]*\/>)\s*$/i.test(start)) return 'is not an SVG document'
  return undefined
}

/** Short content hash: identical icons share one file. */
export function svgFileName(svg: string): string {
  return `${createHash('sha256').update(svg).digest('hex').slice(0, 16)}.svg`
}
