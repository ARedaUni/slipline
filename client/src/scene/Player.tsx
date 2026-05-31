import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { advanceFixedLoop } from '../engine/fixedLoop'
import { useInput } from '../engine/input/InputContext'
import { usePhysics } from '../engine/PhysicsContext'
import { createRapierCharacterBody } from '../engine/rapierAdapter'
import { createRapierAnchorProbe } from '../engine/rapierAnchorProbe'
import { buildIntent } from '../sim/intent'
import {
  type CharacterState,
  type StepTuning,
  stepCharacter,
} from '../sim/step'

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
  grapple: { restLength: 5, stiffness: 40, damping: 4, maxRange: 20 },
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

  // Seed state.position from Rapier's spawn translation so sim and
  // engine agree from tick 0. After this, stepCharacter writes position
  // from each tryMove response, keeping them in lock-step.
  const stateRef = useRef<CharacterState>(
    ((): CharacterState => {
      const t = physics.player.translation()
      return {
        position: [t.x, t.y, t.z],
        velocity: [0, 0, 0],
        grounded: false,
        groundNormal: [0, 1, 0],
        grapple: { attached: false },
        wasAttachIntentHeld: false,
      }
    })(),
  )
  const accumulatorRef = useRef(0)

  const body = useMemo(() => createRapierCharacterBody(physics), [physics])
  const probe = useMemo(() => createRapierAnchorProbe(physics), [physics])

  // One-shot setup. First-person look needs Y (yaw) before X (pitch), else
  // pitching while yawed introduces unwanted roll. Three's default is XYZ.
  useEffect(() => {
    camera.rotation.order = 'YXZ'
  }, [camera])

  useFrame((_, delta) => {
    accumulatorRef.current = advanceFixedLoop(
      accumulatorRef.current,
      delta,
      () => {
        const look = input.mouse.getLook()
        const intent = buildIntent({
          ...input.keyboard.getKeys(),
          yaw: look.yaw,
          pitch: look.pitch,
          fireGrapple: input.mouse.consumeFireClick(),
          fireHeld: input.mouse.isFireHeld(),
        })

        stateRef.current = stepCharacter(
          stateRef.current,
          intent,
          body,
          probe,
          TUNING,
          FIXED_DT,
        )
      },
      LOOP_OPTS,
    )

    // imperative camera sync — eye at top of capsule, yaw+pitch from mouse
    const t = physics.player.translation()
    const look = input.mouse.getLook()
    camera.position.set(t.x, t.y + PLAYER_EYE_OFFSET, t.z)
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
