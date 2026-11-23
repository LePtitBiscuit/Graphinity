import { describe, expect, it } from 'vitest'
import { MAX_SVG_BYTES, svgProblem } from '../../../src/core/index.ts'

const svg = (body: string, attributes = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"${attributes}>${body}</svg>`

describe('svgProblem', () => {
  it('accepts ordinary icons, with gradients, internal links, styles and prologs', () => {
    expect(svgProblem(svg('<path d="M0 0h24v24H0z" fill="#3a4d54"/>'))).toBeUndefined()
    expect(
      svgProblem(
        svg(
          '<defs><linearGradient id="a"><stop offset="0" style="stop-color:#aa5cc3"/></linearGradient></defs>' +
            '<path fill="url(#a)" d="M0 0h1v1z"/><use href="#a"/><use xlink:href=\'#a\'/>',
          ' xmlns:xlink="http://www.w3.org/1999/xlink"',
        ),
      ),
    ).toBeUndefined()
    expect(svgProblem(`﻿<?xml version="1.0"?>\n<!-- Generator: x -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n${svg('')}\n`)).toBeUndefined()
  })

  it.each([
    ['<script>alert(1)</script>', 'contains a script'],
    ['<foreignObject><div/></foreignObject>', 'contains foreign (HTML) content'],
    ['<iframe src="x"></iframe>', 'contains an HTML element'],
    ['<rect onload="alert(1)"/>', 'has an event handler attribute'],
    ['<a href="javascript:alert(1)"><path/></a>', 'contains a script URL'],
    ['<image href="https://example.com/x.png"/>', 'links to an external resource'],
    ['<use xlink:href="other.svg#a"/>', 'links to an external resource'],
    ['<path style="fill:url(https://example.com/x)"/>', 'references an external resource'],
    ['<style>@import "x.css";</style>', 'imports a stylesheet'],
    ['<set attributeName="fill" to="red"/>', 'contains a <set> animation'],
    ['<a><animate attributeName="href" values="#a"/></a>', 'animates a link'],
  ])('refuses %s', (body, problem) => {
    expect(svgProblem(svg(body))).toBe(problem)
  })

  it('refuses entities, non-SVG documents and huge files', () => {
    expect(svgProblem(`<!DOCTYPE svg [<!ENTITY x "y">]>${svg('')}`)).toBe('declares entities')
    expect(svgProblem('<html><body/></html>')).toBe('contains an HTML element')
    expect(svgProblem('<g/>')).toBe('is not an SVG document')
    expect(svgProblem('not xml')).toBe('is not an SVG document')
    expect(svgProblem(svg(`<!-- ${'x'.repeat(MAX_SVG_BYTES)} -->`))).toMatch(/too large/)
  })
})
