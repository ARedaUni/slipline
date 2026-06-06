import { useFrame } from '@react-three/fiber'
import { type RefObject, useMemo, useRef } from 'react'
import type { BufferAttribute, LineSegments } from 'three'
import type { CharacterState } from '../sim/step'

// Visual rope for the grapple. View-of-model: reads stateRef each tick
// and updates a single line between the player and the anchor.
// No test of its own (mirrors Arena.tsx) — the underlying GrappleState
// transitions are driven test-first in sim/grapple.ts; this component
// just projects them to pixels.
//
// Discipline (per CLAUDE.md, mirrors Player.tsx):
//  - The line is declared via R3F JSX, so R3F instantiates Three through
//    its own module copy. No `import * as THREE` here — only TYPE
//    imports, which are erased at build time. Avoids the "Multiple
//    instances of Three.js" warning that a runtime import would cause.
//  - Per-frame updates write directly to the BufferAttribute's array via
//    a ref. React reconciles only on mount/unmount, never on movement.

const ROPE_COLOR = '#ffaa66'

type Props = {
  readonly stateRef: RefObject<CharacterState>
}

export const Grapple = ({ stateRef }: Props) => {
  // LineSegments (not Line) sidesteps the JSX collision with SVG's <line>.
  // For a single segment between two points the visual is identical.
  const lineRef = useRef<LineSegments>(null)
  // Six floats: [x0,y0,z0, x1,y1,z1]. Stable reference so R3F doesn't
  // rebuild the BufferAttribute on every render.
  const positions = useMemo(() => new Float32Array(6), [])

  useFrame(() => {
    const line = lineRef.current
    if (!line) return

    const state = stateRef.current
    if (!state.grapple.attached) {
      line.visible = false
      return
    }

    const p = state.position
    const a = state.grapple.anchor
    positions[0] = p[0]
    positions[1] = p[1]
    positions[2] = p[2]
    positions[3] = a[0]
    positions[4] = a[1]
    positions[5] = a[2]

    const attr = line.geometry.getAttribute('position') as BufferAttribute
    attr.needsUpdate = true
    line.visible = true
  })

  return (
    <lineSegments ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={ROPE_COLOR} />
    </lineSegments>
  )
}
