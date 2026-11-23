import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildLlmFiles, docPages, KEY_PAGES, toMarkdown } from '../../docs/scripts/llms.ts'

const docsDir = fileURLToPath(new URL('../../docs/', import.meta.url))
const site = 'https://example.github.io/Graphinity/'

/** Lines outside fenced code blocks. */
function prose(markdown: string): string[] {
  let fence = false
  return markdown.split('\n').filter((line) => {
    if (/^(>\s*)?\s*```/.test(line)) {
      fence = !fence
      return false
    }
    return !fence
  })
}

describe('toMarkdown', () => {
  const convert = (source: string, file = 'config/node.md') => toMarkdown(source, file, site)

  it('makes links and images absolute URLs of the site, and leaves code alone', () => {
    const out = convert(
      [
        'See [Node](/config/node#fields), [the API](/reference/api), [below](#limits) and [npm](https://www.npmjs.com/).',
        '![A diagram](/images/lyon.png){.screenshot}',
        'In code: `[x](/y)`.',
        '```md',
        '[kept](/as-is)',
        '```',
      ].join('\n'),
    )
    expect(out).toContain(`[Node](${site}config/node#fields)`)
    expect(out).toContain(`[the API](${site}reference/api)`)
    expect(out).toContain(`[below](${site}config/node#limits)`)
    expect(out).toContain('[npm](https://www.npmjs.com/)')
    expect(out).toContain(`![A diagram](${site}images/lyon.png)`)
    expect(out).not.toContain('{.screenshot}')
    expect(out).toContain('`[x](/y)`')
    expect(out).toContain('[kept](/as-is)')
  })

  it('resolves anchors of index pages to the folder URL', () => {
    expect(convert('[up](#top)', 'cli/index.md')).toContain(`[up](${site}cli/#top)`)
  })

  it('turns containers into quotes and drops code groups', () => {
    const out = convert(['::: warning Not yet published', 'Install it from an archive.', ':::', '', '::: tip', 'A tip.', ':::', '', '::: code-group', '```sh [npm]', 'npm i', '```', ':::'].join('\n'))
    expect(out).toContain('> **Not yet published**\n>\n> Install it from an archive.')
    expect(out).toContain('> **Tip**\n>\n> A tip.')
    expect(out).toContain('**npm**\n\n```sh\nnpm i\n```')
    expect(out).not.toContain(':::')
  })

  it('names titled code blocks and keeps their content', () => {
    const out = convert(['```yaml [architecture.yml]', 'id: shop', 'name: Shop', '```'].join('\n'))
    expect(out).toBe('**architecture.yml**\n\n```yaml\nid: shop\nname: Shop\n```\n')
  })

  it('turns Vue snippets into links and the home page front matter into text', () => {
    const demo = convert(
      [
        '<script setup>',
        "import { withBase } from 'vitepress'",
        '</script>',
        '',
        '# Live demo',
        '',
        `<iframe :src="withBase('/demo/')" title="The demo"></iframe>`,
        `<p><a :href="withBase('/demo/')" target="_blank">Open it</a></p>`,
      ].join('\n'),
      'guide/demo.md',
    )
    expect(demo).toBe(`# Live demo\n\n[The demo](${site}demo/)\n[Open it](${site}demo/)\n`)
    const home = convert(['---', 'layout: home', 'hero:', '  name: Graphinity', '  text: Diagrams', 'features:', '  - title: Files', '    details: The source of truth.', '---', '', '## More'].join('\n'), 'index.md')
    expect(home).toBe('# Graphinity\n\n**Diagrams**\n\n- **Files**: The source of truth.\n\n## More\n')
  })
})

describe('the LLM files of the documentation', async () => {
  const { files, pages } = await buildLlmFiles(docsDir, site, 'Diagrams from YAML.')

  it('publish the pages of the navigation and the home page, and nothing else', () => {
    expect(pages[0]!.file).toBe('index.md')
    for (const page of docPages()) expect(existsSync(path.join(docsDir, page.file)), page.file).toBe(true)
    const published = [...files.keys()].filter((file) => file.endsWith('.md')).sort()
    expect(published).toEqual(pages.map((page) => page.file).sort())
    expect(published.some((file) => /AGENTS|scripts\/|public\//.test(file))).toBe(false)
    expect([...files.keys()]).toContain('llms.txt')
    expect([...files.keys()]).toContain('llms-full.txt')
  })

  it('index every page in llms.txt, with its Markdown URL, by section', () => {
    const index = files.get('llms.txt')!
    expect(index.startsWith('# Graphinity\n\n> Diagrams from YAML.\n')).toBe(true)
    for (const page of pages) expect(index).toContain(`(${site}${page.file})`)
    expect(index).toContain('## Configuration')
    expect(index).toContain(`[Full documentation](${site}llms-full.txt)`)
  })

  it('list the pages to read first at the top of llms.txt, all published', () => {
    const index = files.get('llms.txt')!
    const start = index.indexOf('## Start here')
    expect(start).toBeGreaterThan(0)
    expect(start).toBeLessThan(index.indexOf('## Overview'))
    for (const [file] of KEY_PAGES) {
      expect(pages.map((page) => page.file), file).toContain(file)
      expect(index.slice(start, index.indexOf('## Overview'))).toContain(`(${site}${file})`)
    }
    expect(index).toContain(`[Configuration: Overview](${site}config/index.md)`)
  })

  it('put every page in llms-full.txt, in reading order', () => {
    const full = files.get('llms-full.txt')!
    const positions = pages.map((page) => full.indexOf(files.get(page.file)!))
    expect(positions.every((at) => at >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('contain standard Markdown with absolute links only', () => {
    for (const [file, content] of files) {
      const text = prose(content).join('\n')
      expect(text, file).not.toMatch(/^:::/m)
      expect(text, file).not.toMatch(/\]\(\/(?!\/)/)
      expect(text, file).not.toContain('withBase')
      expect(text, file).not.toMatch(/^<script/m)
      expect(text, file).not.toContain('{.screenshot}')
      // No em dash (U+2014): ASCII hyphens only.
      expect(content, file).not.toContain(String.fromCharCode(0x2014))
      // Fenced code blocks are all closed.
      expect(content.split('\n').filter((line) => /^(>\s*)?\s*```/.test(line)).length % 2, file).toBe(0)
    }
  })
})
