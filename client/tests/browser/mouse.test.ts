import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { createMouse } from '../../src/engine/input/mouse'

// Browser test for Mouse.isFireHeld. The held-state logic depends on
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

// Continuous "fire button held" state — the hold-to-grapple input model.
// Live read (no consume side-effect): true while the primary button is
// down (after pointer-lock is acquired) and back to false on mouseup.
// The sim edge-detects against this; the engine just reports current
// state.
describe('createMouse — isFireHeld continuous state', () => {
  let override: LockOverride | null = null

  beforeEach(() => {
    override = null
  })

  afterEach(() => {
    override?.restore()
  })

  test('returns true between mousedown and mouseup while pointer-lock is held', () => {
    override = overridePointerLockElement(document.body)
    const mouse = createMouse({ element: document.body })

    document.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))
    expect(mouse.isFireHeld()).toBe(true)

    document.dispatchEvent(new MouseEvent('mouseup', { button: 0 }))
    expect(mouse.isFireHeld()).toBe(false)
  })
})
