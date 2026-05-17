import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { useInput } from '../input/InputContext'
import { usePhysics } from '../physics/PhysicsContext'
import type { Vec3 } from '../physics/types'
import type { CharacterBody } from '../sim/character'
import { buildIntent } from '../sim/intent'
import { type StepTuning, stepCharacter } from '../sim/step'

const FIXED_DT = 1 / 60
const MAX_STEPS_PER_FRAME = 5
const PLAYER_EYE_OFFSET = 0.7

const TUNING: StepTuning = {
  gravity: -25,
  jumpSpeed: 7.5,
  groundFriction: 6,
  groundStopSpeed: 1.5,
  groundWishSpeed: 8,
  groundAccel: 10,
  airWishSpeed: 1,
  airAccel: 100,
}

export const Player = () => {
  const physics = usePhysics()
  const input = useInput()
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)

  const velocityRef = useRef<Vec3>([0, 0, 0])
  const groundedRef = useRef(false)
  const accumulatorRef = useRef(0)

  useFrame((_, delta) => {
    accumulatorRef.current += Math.min(delta, MAX_STEPS_PER_FRAME * FIXED_DT)
    physics.world.timestep = FIXED_DT

    // anonymous Rapier adapter for CharacterBody — relocates to
    // engine/rapierAdapter.ts in the next commit
    const body: CharacterBody = {
      tryMove: (desired) => {
        physics.kcc.computeColliderMovement(physics.playerCollider, {
          x: desired[0],
          y: desired[1],
          z: desired[2],
        })
        const corrected = physics.kcc.computedMovement()
        const pos = physics.player.translation()
        physics.player.setNextKinematicTranslation({
          x: pos.x + corrected.x,
          y: pos.y + corrected.y,
          z: pos.z + corrected.z,
        })
        physics.world.step()
        return { grounded: physics.kcc.computedGrounded() }
      },
    }

    while (accumulatorRef.current >= FIXED_DT) {
      const keys = input.keyboard.getKeys()
      const look = input.mouse.getLook()
      const intent = buildIntent({
        forward: keys.forward,
        back: keys.back,
        left: keys.left,
        right: keys.right,
        jump: keys.jump,
        yaw: look.yaw,
      })

      const next = stepCharacter(
        { velocity: velocityRef.current, grounded: groundedRef.current },
        intent,
        body,
        TUNING,
        FIXED_DT,
      )

      velocityRef.current = next.velocity
      groundedRef.current = next.grounded
      accumulatorRef.current -= FIXED_DT
    }

    // imperative camera sync — eye at top of capsule, yaw+pitch from mouse
    const t = physics.player.translation()
    camera.position.set(t.x, t.y + PLAYER_EYE_OFFSET, t.z)
    const look = input.mouse.getLook()
    camera.rotation.order = 'YXZ'
    camera.rotation.set(look.pitch, look.yaw, 0)
  })

  useEffect(() => {
    const canvas = gl.domElement
    const onClick = () => input.mouse.requestLock()
    canvas.addEventListener('click', onClick)
    return () => canvas.removeEventListener('click', onClick)
  }, [gl, input.mouse])

  return null
}
