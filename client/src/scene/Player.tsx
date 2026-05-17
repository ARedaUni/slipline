import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { advanceFixedLoop } from '../engine/fixedLoop'
import { useInput } from '../engine/input/InputContext'
import { usePhysics } from '../engine/PhysicsContext'
import { createRapierCharacterBody } from '../engine/rapierAdapter'
import { buildIntent } from '../sim/intent'
import { type StepTuning, stepCharacter } from '../sim/step'
import type { Vec3 } from '../sim/types'

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

const LOOP_OPTS = {
  dt: FIXED_DT,
  maxStepsPerFrame: MAX_STEPS_PER_FRAME,
}

export const Player = () => {
  const physics = usePhysics()
  const input = useInput()
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)

  const velocityRef = useRef<Vec3>([0, 0, 0])
  const groundedRef = useRef(false)
  const accumulatorRef = useRef(0)

  const body = useMemo(() => createRapierCharacterBody(physics), [physics])

  useFrame((_, delta) => {
    physics.world.timestep = FIXED_DT

    accumulatorRef.current = advanceFixedLoop(
      accumulatorRef.current,
      delta,
      () => {
        const keys = input.keyboard.getKeys()
        const look = input.mouse.getLook()
        const intent = buildIntent({
          forward: keys.forward,
          back: keys.back,
          left: keys.left,
          right: keys.right,
          jump: keys.jump,
          crouch: keys.crouch,
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
      },
      LOOP_OPTS,
    )

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
