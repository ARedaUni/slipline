import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { createMouse } from '../../src/engine/input/mouse'

// Browser test for Mouse.consumeFireClick. The edge logic depends on
// document.pointerLockElement and the DOM event loop, neither of which
// exists in the node-environment unit project — so it lives here. The
// scenarios are scripted with synthetic events rather than real clicks
// so we can control the pointer-lock state deterministically.
//
// We override document.pointerLockElement via Object.defineProperty.
// It's a read-only DOM property under normal use; the override is
// scoped per test and restored in afterEach.

type LockOverride = {
  restore: () => void
}

const overridePointerLockElement = (value: Element | null): LockOverride => {
  const original = Object.getOwnPropertyDescriptor(
    Document.prototype,
    'pointerLockElement',
  )
  Object.defineProperty(document, 'pointerLockElement', {
    configurable: true,
    get: () => value,
  })
  return {
    restore: () => {
      if (original) {
        Object.defineProperty(
          Document.prototype,
          'pointerLockElement',
          original,
        )
      }
      // @ts-expect-error reset by deleting our override
      delete document.pointerLockElement
    },
  }
}

describe('createMouse — consumeFireClick edge semantics', () => {
  let override: LockOverride | null = null

  beforeEach(() => {
    override = null
  })

  afterEach(() => {
    override?.restore()
  })

  test('returns false when no mousedown has occurred', () => {
    const mouse = createMouse({ element: document.body })

    expect(mouse.consumeFireClick()).toBe(false)
  })

  test('returns true once after a primary mousedown while pointer-lock is held', () => {
    override = overridePointerLockElement(document.body)
    const mouse = createMouse({ element: document.body })

    document.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))

    expect(mouse.consumeFireClick()).toBe(true)
    // Consume clears the pulse — the sim observes the edge exactly once.
    expect(mouse.consumeFireClick()).toBe(false)
  })

  test('ignores mousedowns while pointer-lock is NOT held', () => {
    // pointerLockElement is null by default in the test page — the
    // first lock-grabbing click must not also fire the grapple.
    const mouse = createMouse({ element: document.body })

    document.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))

    expect(mouse.consumeFireClick()).toBe(false)
  })

  test('ignores non-primary buttons (right, middle)', () => {
    override = overridePointerLockElement(document.body)
    const mouse = createMouse({ element: document.body })

    document.dispatchEvent(new MouseEvent('mousedown', { button: 1 })) // middle
    document.dispatchEvent(new MouseEvent('mousedown', { button: 2 })) // right

    expect(mouse.consumeFireClick()).toBe(false)
  })
})
