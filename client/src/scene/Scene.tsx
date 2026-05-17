import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh } from 'three'
import { usePhysics } from '../physics/PhysicsContext'

const FIXED_DT = 1 / 60
const MAX_STEPS_PER_FRAME = 5

const FallingCube = () => {
  const physics = usePhysics()
  const meshRef = useRef<Mesh>(null)
  const accumulatorRef = useRef(0)

  useFrame((_, delta) => {
    accumulatorRef.current += Math.min(delta, MAX_STEPS_PER_FRAME * FIXED_DT)
    physics.world.timestep = FIXED_DT
    while (accumulatorRef.current >= FIXED_DT) {
      physics.world.step()
      accumulatorRef.current -= FIXED_DT
    }
    const mesh = meshRef.current
    if (!mesh) return
    const t = physics.cube.translation()
    const r = physics.cube.rotation()
    mesh.position.set(t.x, t.y, t.z)
    mesh.quaternion.set(r.x, r.y, r.z, r.w)
  })

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  )
}

const Ground = () => (
  <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <planeGeometry args={[20, 20]} />
    <meshStandardMaterial color="#333" />
  </mesh>
)

export const Scene = () => (
  <Canvas camera={{ position: [6, 5, 8], fov: 55 }} shadows>
    <color attach="background" args={['#16171d']} />
    <ambientLight intensity={0.4} />
    <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
    <Ground />
    <FallingCube />
  </Canvas>
)
