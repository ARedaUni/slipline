import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import App from '../../src/App'
import { InputProvider } from '../../src/engine/input/InputContext'
import { createKeyboard } from '../../src/engine/input/keyboard'
import { createMouse } from '../../src/engine/input/mouse'
import { PhysicsProvider } from '../../src/engine/PhysicsContext'
import { createPhysicsWorld } from '../../src/engine/physicsWorld'

test('mounts a WebGL canvas with PhysicsProvider + InputProvider', async () => {
  const world = await createPhysicsWorld()
  const input = { keyboard: createKeyboard(), mouse: createMouse() }
  const screen = await render(
    <PhysicsProvider value={world}>
      <InputProvider value={input}>
        <App />
      </InputProvider>
    </PhysicsProvider>,
  )
  const canvas = screen.container.querySelector('canvas')
  await expect.poll(() => canvas).not.toBeNull()
  expect(canvas).toBeInstanceOf(HTMLCanvasElement)
})
