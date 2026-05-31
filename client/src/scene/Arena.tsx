import { ARENA, type ArenaPiece } from '../engine/arena'

// One mesh per arena piece. Each piece is a convex box (Quake-style brush):
// the same dimensions feed createArena's collider and this mesh's geometry,
// so visual and physics geometry cannot drift apart.

const PieceMesh = ({ piece }: { piece: ArenaPiece }) => (
  <mesh
    position={[piece.center.x, piece.center.y, piece.center.z]}
    rotation={[0, 0, piece.rotationZ ?? 0]}
    receiveShadow
    castShadow={piece.castShadow ?? true}
  >
    <boxGeometry
      args={[
        piece.halfExtents.x * 2,
        piece.halfExtents.y * 2,
        piece.halfExtents.z * 2,
      ]}
    />
    <meshStandardMaterial color={piece.color} />
  </mesh>
)

export const Arena = () => (
  <>
    {ARENA.map((piece) => (
      <PieceMesh key={piece.id} piece={piece} />
    ))}
  </>
)
