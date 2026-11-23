// LLM-friendly versions of the documentation, generated from the Markdown pages themselves:
//
//   llms.txt        an index of the pages (https://llmstxt.org), linking to their Markdown versions
//   llms-full.txt   every page, in reading order, in one Markdown file
//   <page>.md       each page as plain Markdown, next to its HTML page (/config/node -> /config/node.md)
//
// Only the pages of the navigation (docs/.vitepress/sidebar.ts) and the home page are published:
// contributor notes, scripts and generated files never are. VitePress syntax is turned into
// standard Markdown (containers, titled code blocks, Vue and HTML snippets), and links into
// absolute URLs of the published site. Written by the `buildEnd` hook of the VitePress
// configuration on every build, and served by its dev server.
import { readFile } from 'node:fs/promises'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parse } from 'yaml'
import { sidebar } from '../.vitepress/sidebar.ts'

export interface DocPage {
  /** Source file, relative to docs/ (`config/node.md`). */
  file: string
  /** Title in the navigation. */
  title: string
  /** Navigation section (`Configuration`); the home page has none. */
  section?: string
}

/** The published pages, in reading order: the home page, then the navigation. */
export function docPages(): DocPage[] {
  const pages: DocPage[] = [{ file: 'index.md', title: 'Graphinity' }]
  const visit = (items: readonly { text?: string; link?: string; items?: unknown[] }[], section?: string) => {
    for (const item of items) {
      if (item.link) pages.push({ file: fileOf(item.link), title: item.text ?? item.link, ...(section && { section }) })
      if (item.items) visit(item.items as typeof items, item.link ? section : (item.text ?? section))
    }
  }
  visit(Array.isArray(sidebar) ? sidebar : [])
  return pages
}

/** `/config/` -> `config/index.md`, `/config/node` -> `config/node.md`. */
function fileOf(link: string): string {
  const clean = link.replace(/^\//, '').replace(/[#?].*$/, '')
  return clean === '' || clean.endsWith('/') ? `${clean}index.md` : `${clean}.md`
}

/** The HTML page of a source file (clean URLs): `config/index.md` -> `config/`, `config/node.md` -> `config/node`. */
function pageUrl(file: string): string {
  return file.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')
}

const CONTAINER = /^:::\s*([\w-]+)?\s*(.*)$/

/**
 * One page as standard Markdown. `siteUrl` is the absolute URL of the site root, with a trailing
 * slash (`https://example.github.io/Graphinity/`).
 */
export function toMarkdown(source: string, file: string, siteUrl: string): string {
  let text = source.replace(/\r\n/g, '\n')
  let intro = ''
  // Front matter: the home page's hero and features become text, the rest is dropped.
  const front = /^---\n([\s\S]*?)\n---\n/.exec(text)
  if (front) {
    text = text.slice(front[0].length)
    const data = (parse(front[1]!) ?? {}) as { hero?: { name?: string; text?: string; tagline?: string }; features?: { title?: string; details?: string }[] }
    if (data.hero) {
      intro += `# ${data.hero.name ?? 'Graphinity'}\n\n`
      if (data.hero.text) intro += `**${data.hero.text}**\n\n`
      if (data.hero.tagline) intro += `${data.hero.tagline}\n\n`
    }
    if (data.features?.length) intro += `${data.features.map((f) => `- **${f.title}**: ${f.details}`).join('\n')}\n\n`
  }
  // Vue setup blocks: code of the page, not content.
  text = text.replace(/^<script setup>[\s\S]*?<\/script>\n*/gm, '')

  const absolute = (target: string): string => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return target // already absolute (https:, mailto:)
    if (target.startsWith('#')) return `${siteUrl}${pageUrl(file)}${target}`
    if (target.startsWith('/')) return `${siteUrl}${target.slice(1)}`
    return new URL(target, `${siteUrl}${file}`).href
  }

  const out: string[] = []
  let fence: string | undefined
  /** Open containers: `quote` for admonitions (tip, warning…), `plain` for code groups. */
  const containers: ('quote' | 'plain')[] = []
  const prefix = () => (containers.includes('quote') ? '> ' : '')
  for (const raw of text.split('\n')) {
    const line = raw
    const fenceMark = /^(\s*)(```+|~~~+)(.*)$/.exec(line)
    if (fence) {
      out.push(`${prefix()}${line}`.trimEnd())
      if (fenceMark && fenceMark[2]!.startsWith(fence) && fenceMark[3]!.trim() === '') fence = undefined
      continue
    }
    if (fenceMark) {
      // ```yaml [architecture.yml] {2,4} -> a bold file name, then ```yaml
      fence = fenceMark[2]!
      const info = /^([\w+-]*)\s*(?:\[([^\]]+)\])?/.exec(fenceMark[3]!.trim())
      if (info?.[2]) out.push(`${prefix()}**${info[2]}**`, prefix().trimEnd())
      out.push(`${prefix()}${fenceMark[1]}${fence}${info?.[1] ?? ''}`)
      continue
    }
    const container = CONTAINER.exec(line)
    if (container) {
      const [, kind, title] = container
      if (kind) {
        if (kind === 'code-group' || kind === 'raw') containers.push('plain')
        else {
          containers.push('quote')
          out.push(`> **${title?.trim() || kind.charAt(0).toUpperCase() + kind.slice(1)}**`, '>')
        }
      } else containers.pop()
      continue
    }
    let converted = line
    // HTML with VitePress links: <iframe :src="withBase('/demo/')" title="…"> or <a :href="withBase('/x')">text</a>
    const based = /withBase\('([^']+)'\)/.exec(converted)
    if (based) {
      const url = absolute(based[1]!)
      const label = /<a\b[^>]*>([^<]*)<\/a>/.exec(converted)?.[1] ?? /title="([^"]*)"/.exec(converted)?.[1] ?? url
      converted = `[${label.trim()}](${url})`
    }
    converted = converted
      // Image attributes: ![…](/images/x.png){.screenshot}
      .replace(/(!\[[^\]]*\]\([^)]*\))\{[^}]*\}/g, '$1')
      // Links and images: absolute URLs. Inline code is left untouched.
      .split(/(`[^`]*`)/)
      .map((part, i) => (i % 2 === 1 ? part : part.replace(/(\]\()([^)\s]+)(\))/g, (_, open, target: string, close) => `${open}${absolute(target)}${close}`)))
      .join('')
    out.push(`${prefix()}${converted}`.trimEnd())
  }
  return `${intro}${out.join('\n')}`.replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

/** The first paragraph of a page, as one line (llms.txt descriptions). */
function summary(markdown: string): string {
  const paragraph = markdown
    .split('\n\n')
    .map((block) => block.trim())
    .find((block) => block && !/^(#|>|```|\||-|\*\*|!\[|<)/.test(block))
  const line = (paragraph ?? '').replace(/\s+/g, ' ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  return line.length > 180 ? `${line.slice(0, 177).replace(/\s+\S*$/, '')}...` : line
}

export interface LlmFiles {
  /** Output path relative to the site root -> content. */
  files: Map<string, string>
  pages: DocPage[]
}

/** Every LLM file of the documentation in `docsDir`, for the site at `siteUrl`. */
export async function buildLlmFiles(docsDir: string, siteUrl: string, description: string): Promise<LlmFiles> {
  const site = siteUrl.replace(/\/?$/, '/')
  const pages = docPages()
  const files = new Map<string, string>()
  const index: string[] = [
    '# Graphinity',
    '',
    `> ${description}`,
    '',
    `Graphinity turns YAML or JSON files into interactive, recursive architecture diagrams: each file is a universe, and a node can open another one. This index lists every page of the documentation as Markdown; the whole documentation is also in one file: ${site}llms-full.txt`,
  ]
  const full: string[] = [`# Graphinity documentation\n\n> ${description}\n\nSource: ${site}\n`]
  let section: string | undefined = '\u0000'
  for (const page of pages) {
    const markdown = toMarkdown(await readFile(path.join(docsDir, page.file), 'utf8'), page.file, site)
    files.set(page.file, markdown)
    full.push(`---\n\nSource: ${site}${pageUrl(page.file)}\n\n${markdown}`)
    if (page.section !== section) {
      section = page.section
      index.push('', `## ${section ?? 'Overview'}`, '')
    }
    const about = summary(markdown)
    index.push(`- [${page.title}](${site}${page.file})${about ? `: ${about}` : ''}`)
  }
  index.push('', '## Optional', '', `- [Full documentation](${site}llms-full.txt): every page above, in one Markdown file`)
  files.set('llms.txt', `${index.join('\n')}\n`)
  files.set('llms-full.txt', full.join('\n'))
  return { files, pages }
}

/** Writes the files into the built site. */
export async function writeLlmFiles(outDir: string, { files }: LlmFiles): Promise<void> {
  for (const [relative, content] of files) {
    const target = path.join(outDir, ...relative.split('/'))
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, content)
  }
}
