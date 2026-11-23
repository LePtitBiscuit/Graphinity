import { describe, expect, it } from 'vitest'
import { readableBrandColor } from '../../viewer/src/colors.ts'

describe('readableBrandColor', () => {
  it('keeps brand colors that stand out on the dark cards', () => {
    expect(readableBrandColor('F38020')).toBe('#F38020')
    expect(readableBrandColor('4FC08D')).toBe('#4FC08D')
  })

  it('replaces colors too dark for the canvas', () => {
    expect(readableBrandColor('181717')).toBe('#e6e9ef')
    expect(readableBrandColor('000000')).toBe('#e6e9ef')
  })

  it('ignores malformed values', () => {
    expect(readableBrandColor('red')).toBe('#e6e9ef')
    expect(readableBrandColor('ff0000;background:url(x)')).toBe('#e6e9ef')
  })
})
