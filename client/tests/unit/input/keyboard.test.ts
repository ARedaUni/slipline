import { describe, expect, it } from 'vitest'
import { codeToAction } from '../../../src/input/keyboard'

describe('codeToAction (semantic key mapping)', () => {
  it('maps WASD to movement actions', () => {
    expect(codeToAction('KeyW')).toBe('forward')
    expect(codeToAction('KeyS')).toBe('back')
    expect(codeToAction('KeyA')).toBe('left')
    expect(codeToAction('KeyD')).toBe('right')
  })

  it('maps Space to jump', () => {
    expect(codeToAction('Space')).toBe('jump')
  })

  it('maps both Shift variants to crouch (left and right hand)', () => {
    expect(codeToAction('ShiftLeft')).toBe('crouch')
    expect(codeToAction('ShiftRight')).toBe('crouch')
  })

  it('returns null for unmapped codes (so the listener can early-return)', () => {
    expect(codeToAction('KeyQ')).toBeNull()
    expect(codeToAction('Tab')).toBeNull()
    expect(codeToAction('Escape')).toBeNull()
  })
})
