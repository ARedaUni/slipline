import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { InputProvider } from './engine/input/InputContext'
import { createKeyboard } from './engine/input/keyboard'
import { createMouse } from './engine/input/mouse'
import { PhysicsProvider } from './engine/PhysicsContext'
import { createPhysicsWorld } from './engine/physicsWorld'
import { TuningProvider } from './engine/TuningContext'
import { createTuningStore } from './engine/tuning'
import { DEFAULT_TUNING } from './sim/step'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found in index.html')
}

const world = await createPhysicsWorld()
const input = {
  keyboard: createKeyboard(),
  mouse: createMouse(),
}
const tuning = createTuningStore(DEFAULT_TUNING)

createRoot(rootElement).render(
  <StrictMode>
    <PhysicsProvider value={world}>
      <InputProvider value={input}>
        <TuningProvider value={tuning}>
          <App />
        </TuningProvider>
      </InputProvider>
    </PhysicsProvider>
  </StrictMode>,
)
