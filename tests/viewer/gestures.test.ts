import { describe, expect, it } from 'vitest'
import { boundsOf, createScrollGesture, easeOut, enterTarget, fitZoom, SCROLL_AMOUNT, wheelDistance } from '../../viewer/src/gestures.ts'

describe('createScrollGesture', () => {
  it('fills with the amount scrolled, not with time', () => {
    const gesture = createScrollGesture({ amount: 300, idle: 350 })
    expect(gesture.feed('enter', 'vps', -100, 0)).toEqual({ kind: 'enter', target: 'vps', progress: 1 / 3, done: false })
    expect(gesture.feed('enter', 'vps', -100, 20)).toMatchObject({ progress: 2 / 3, done: false })
    // Time alone does not fill it.
    expect(gesture.state(300)?.progress).toBeCloseTo(2 / 3)
    expect(gesture.feed('enter', 'vps', -150, 320)).toMatchObject({ progress: 1, done: true })
  })

  it('is filled by a few notches of the wheel by default', () => {
    const gesture = createScrollGesture()
    let hold = gesture.feed('exit', undefined, 100, 0)
    let notches = 1
    for (let t = 16; !hold.done && t < 1000; t += 16, notches++) hold = gesture.feed('exit', undefined, 100, t)
    expect(hold.done).toBe(true)
    expect(notches).toBe(SCROLL_AMOUNT / 100)
  })

  it('eases out', () => {
    expect(easeOut(0)).toBe(0)
    expect(easeOut(1)).toBe(1)
    expect(easeOut(0.5)).toBeGreaterThan(0.5)
    expect(easeOut(2)).toBe(1)
  })

  it('is cancelled by a pause', () => {
    const gesture = createScrollGesture({ amount: 300, idle: 350 })
    gesture.feed('exit', undefined, 120, 0)
    expect(gesture.state(300)).toMatchObject({ kind: 'exit', progress: 0.4 })
    expect(gesture.state(400)).toBeUndefined()
    // Scrolling again starts from zero.
    expect(gesture.feed('exit', undefined, 30, 500).progress).toBeCloseTo(0.1)
  })

  it('starts again when the node or the direction changes', () => {
    const gesture = createScrollGesture({ amount: 100, idle: 500 })
    gesture.feed('enter', 'a', -50, 0)
    expect(gesture.feed('enter', 'b', -10, 100).progress).toBeCloseTo(0.1)
    expect(gesture.feed('exit', undefined, 20, 200).progress).toBeCloseTo(0.2)
    gesture.reset()
    expect(gesture.state(200)).toBeUndefined()
  })
})

describe('wheelDistance', () => {
  it('converts lines and pages to pixels', () => {
    expect(wheelDistance({ deltaY: -100, deltaMode: 0 }, 800)).toBe(-100)
    expect(wheelDistance({ deltaY: 3, deltaMode: 1 }, 800)).toBe(75)
    expect(wheelDistance({ deltaY: 1, deltaMode: 2 }, 800)).toBe(800)
  })
})

describe('enterTarget', () => {
  const rect = (x: number, y: number, size = 100) => ({ x, y, width: size, height: size })
  const viewport = { x: 0, y: 0, zoom: 1 }
  const center = { x: 500, y: 300 }

  it('takes the only candidate, wherever it is and wherever the cursor is', () => {
    expect(enterTarget([{ id: 'far', rect: rect(5000, 5000) }], viewport, { x: 0, y: 0 })).toBe('far')
    expect(enterTarget([], viewport, center)).toBeUndefined()
  })

  it('takes the candidate closest to the mouse cursor', () => {
    const candidates = [
      { id: 'left', rect: rect(0, 250) },
      { id: 'middle', rect: rect(420, 260) },
      { id: 'right', rect: rect(900, 250) },
    ]
    expect(enterTarget(candidates, viewport, center)).toBe('middle')
    expect(enterTarget(candidates, viewport, { x: 40, y: 580 })).toBe('left')
    expect(enterTarget(candidates, viewport, { x: 990, y: 10 })).toBe('right')
    // Panned and zoomed: the screen point (x, 300) is at flow ((x + 600) / 2, 300).
    expect(enterTarget(candidates, { x: -600, y: -300, zoom: 2 }, { x: 400, y: 300 })).toBe('middle')
    expect(enterTarget(candidates, { x: -600, y: -300, zoom: 2 }, { x: 1000, y: 300 })).toBe('right')
  })

  it('prefers the node under the cursor, even when the center of another one is closer', () => {
    const candidates = [
      { id: 'large', rect: rect(0, 0, 400) },
      { id: 'small', rect: rect(420, 360, 40) },
    ]
    // On the right edge of the large node: its center is 210 px away, the small one's 120 px.
    expect(enterTarget(candidates, viewport, { x: 395, y: 290 })).toBe('large')
    expect(enterTarget(candidates, viewport, { x: 430, y: 370 })).toBe('small')
  })
})

describe('fitZoom', () => {
  it('computes the zoom of fit view, within the limits', () => {
    const bounds = { x: 0, y: 0, width: 1000, height: 500 }
    expect(fitZoom(bounds, { width: 1150, height: 1000 }, 0.15, 0.1, 1)).toBeCloseTo(1)
    expect(fitZoom(bounds, { width: 575, height: 1000 }, 0.15, 0.1, 1)).toBeCloseTo(0.5)
    expect(fitZoom(bounds, { width: 10, height: 10 }, 0.15, 0.1, 1)).toBe(0.1)
    expect(fitZoom({ x: 0, y: 0, width: 0, height: 0 }, { width: 100, height: 100 }, 0.15, 0.1, 1)).toBe(1)
  })

  it('bounds rectangles', () => {
    expect(boundsOf([{ x: 10, y: 20, width: 5, height: 5 }, { x: -5, y: 0, width: 10, height: 50 }])).toEqual({ x: -5, y: 0, width: 20, height: 50 })
    expect(boundsOf([])).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })
})
