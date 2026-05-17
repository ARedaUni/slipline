import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { useInput } from '../input/InputContext'
import { accelerate, applyFriction } from '../physics/movement'
import { usePhysics } from '../physics/PhysicsContext'
import type { Vec3 } from '../physics/types'
import { buildIntent } from '../sim/intent'

const FIXED_DT = 1 / 60
const MAX_STEPS_PER_FRAME = 5

const GRAVITY = -25
const JUMP_SPEED = 7.5
const PLAYER_EYE_OFFSET = 0.7

const GROUND_FRICTION = 6
const GROUND_STOP_SPEED = 1.5
const GROUND_WISH_SPEED = 8
const GROUND_ACCEL = 10

const AIR_WISH_SPEED = 1
const AIR_ACCEL = 100

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

      let v = velocityRef.current

      // gravity
      v = [v[0], v[1] + GRAVITY * FIXED_DT, v[2]]

      // jump: only when grounded; immediately ungrounds
      if (groundedRef.current && intent.wantsJump) {
        v = [v[0], JUMP_SPEED, v[2]]
        groundedRef.current = false
      }

      // ground branch vs air branch
      if (groundedRef.current) {
        v = applyFriction(v, {
          friction: GROUND_FRICTION,
          stopSpeed: GROUND_STOP_SPEED,
          dt: FIXED_DT,
        })
        v = accelerate(v, {
          wishDir: intent.wishDir,
          wishSpeed: GROUND_WISH_SPEED,
          accel: GROUND_ACCEL,
          dt: FIXED_DT,
        })
      } else {
        v = accelerate(v, {
          wishDir: intent.wishDir,
          wishSpeed: AIR_WISH_SPEED,
          accel: AIR_ACCEL,
          dt: FIXED_DT,
        })
      }

      // ask KCC how much of (v * dt) we can actually move
      physics.kcc.computeColliderMovement(physics.playerCollider, {
        x: v[0] * FIXED_DT,
        y: v[1] * FIXED_DT,
        z: v[2] * FIXED_DT,
      })
      const corrected = physics.kcc.computedMovement()

      const pos = physics.player.translation()
      physics.player.setNextKinematicTranslation({
        x: pos.x + corrected.x,
        y: pos.y + corrected.y,
        z: pos.z + corrected.z,
      })

      physics.world.step()

      const nowGrounded = physics.kcc.computedGrounded()
      groundedRef.current = nowGrounded

      // landing: kill downward velocity so gravity doesn't accumulate
      if (nowGrounded && v[1] < 0) {
        v = [v[0], 0, v[2]]
      }

      velocityRef.current = v
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
