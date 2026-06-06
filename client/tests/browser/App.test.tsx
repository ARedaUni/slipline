import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import App from '../../src/App'
import { InputProvider } from '../../src/engine/input/InputContext'
import { createKeyboard } from '../../src/engine/input/keyboard'
import { createMouse } from '../../src/engine/input/mouse'
import { PhysicsProvider } from '../../src/engine/PhysicsContext'
import { createPhysicsWorld } from '../../src/engine/physicsWorld'
import { TuningProvider } from '../../src/engine/TuningContext'
import { createTuningStore } from '../../src/engine/tuning'
import { DEFAULT_TUNING } from '../../src/sim/step'

test('mounts canvas + tuning HUD under all providers', async () => {
  const world = await createPhysicsWorld()
  const input = { keyboard: createKeyboard(), mouse: createMouse() }
  const tuning = createTuningStore(DEFAULT_TUNING)
  const screen = await render(
    <PhysicsProvider value={world}>
      <InputProvider value={input}>
        <TuningProvider value={tuning}>
          <App />
        </TuningProvider>
      </InputProvider>
    </PhysicsProvider>,
  )
  const canvas = screen.container.querySelector('canvas')
  await expect.poll(() => canvas).not.toBeNull()
  expect(canvas).toBeInstanceOf(HTMLCanvasElement)

  const hud = screen.container.querySelector('[data-testid="tuning-hud"]')
  expect(hud).not.toBeNull()
})
