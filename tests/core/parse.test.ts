import { describe, expect, it } from 'vitest'
import { parseConfig } from '../../src/core/parse.ts'

describe('parseConfig', () => {
  it('parses YAML and locates fields', () => {
    const result = parseConfig('id: u\nnodes:\n  - id: a\n    name: A\n', 'yaml')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.data).toEqual({ id: 'u', nodes: [{ id: 'a', name: 'A' }] })
    expect(result.config.locate(['nodes', 0, 'name'])).toEqual({ line: 4, column: 11 })
    // Missing field: falls back to the closest existing ancestor.
    expect(result.config.locate(['nodes', 0, 'icon'])).toEqual({ line: 3, column: 5 })
    // Path through a scalar.
    expect(result.config.locate(['id', 'x'])).toEqual({ line: 1, column: 5 })
  })

  it('parses JSON (with a BOM)', () => {
    const result = parseConfig('﻿{"id": "u"}', 'json')
    expect(result.ok && result.config.data).toEqual({ id: 'u' })
  })

  it('rejects YAML tags instead of interpreting them', () => {
    const result = parseConfig('id: !!js/function "function () { return 1 }"\n', 'yaml')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues[0]!.message).toMatch(/Unresolved tag/)
    expect(parseConfig('id: !custom x\n', 'yaml').ok).toBe(false)
  })

  it('rejects duplicate keys and multiple documents', () => {
    expect(parseConfig('id: a\nid: b\n', 'yaml').ok).toBe(false)
    expect(parseConfig('{"id": "a", "id": "b"}', 'json').ok).toBe(false)
    expect(parseConfig('id: a\n---\nid: b\n', 'yaml').ok).toBe(false)
  })

  it('does not let __proto__ keys pollute prototypes', () => {
    const result = parseConfig('__proto__: { polluted: true }\n', 'yaml')
    expect(result.ok).toBe(true)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    if (result.ok) expect(Object.getPrototypeOf(result.config.data)).toBe(Object.prototype)
  })

  it('limits alias expansion', () => {
    const bomb = [
      'a: &a [x, x, x, x, x, x, x, x, x, x]',
      'b: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a, *a]',
      'c: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b, *b]',
      'd: [*c, *c, *c, *c, *c, *c, *c, *c, *c, *c]',
    ].join('\n')
    expect(parseConfig(bomb, 'yaml').ok).toBe(false)
  })

  it('does not apply YAML merge keys', () => {
    const result = parseConfig('base: &b { x: 1 }\nother:\n  <<: *b\n', 'yaml')
    expect(result.ok && result.config.data).toEqual({ base: { x: 1 }, other: { '<<': { x: 1 } } })
  })
})
