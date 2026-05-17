import { Canvas } from '@react-three/fiber'
import { Player } from './Player'

const Ground = () => (
  <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <planeGeometry args={[20, 20]} />
    <meshStandardMaterial color="#333" />
  </mesh>
)

const ReferenceCube = () => (
  <mesh position={[3, 0.5, 0]} castShadow>
    <boxGeometry args={[1, 1, 1]} />
    <meshStandardMaterial color="hotpink" />
  </mesh>
)

export const Scene = () => (
  <Canvas camera={{ fov: 75 }} shadows>
    <color attach="background" args={['#16171d']} />
    <ambientLight intensity={0.4} />
    <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
    <Ground />
    <ReferenceCube />
    <Player />
  </Canvas>
)
