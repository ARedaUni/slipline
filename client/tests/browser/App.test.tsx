import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import App from '../../src/App'
import { PhysicsProvider } from '../../src/physics/PhysicsContext'
import { createPhysicsWorld } from '../../src/physics/world'

test('mounts a WebGL canvas when wrapped in PhysicsProvider', async () => {
  const world = await createPhysicsWorld()
  const screen = await render(
    <PhysicsProvider value={world}>
      <App />
    </PhysicsProvider>,
  )
  const canvas = screen.container.querySelector('canvas')
  await expect.poll(() => canvas).not.toBeNull()
  expect(canvas).toBeInstanceOf(HTMLCanvasElement)
})
