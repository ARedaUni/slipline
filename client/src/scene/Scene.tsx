import { Canvas } from '@react-three/fiber'
import { Arena } from './Arena'
import { Player } from './Player'

export const Scene = () => (
  <Canvas camera={{ fov: 75 }} shadows>
    <color attach="background" args={['#16171d']} />
    <ambientLight intensity={0.4} />
    <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
    <Arena />
    <Player />
  </Canvas>
)
