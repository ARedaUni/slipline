import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { InputProvider } from './engine/input/InputContext'
import { createKeyboard } from './engine/input/keyboard'
import { createMouse } from './engine/input/mouse'
import { PhysicsProvider } from './engine/PhysicsContext'
import { createPhysicsWorld } from './engine/physicsWorld'
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

createRoot(rootElement).render(
  <StrictMode>
    <PhysicsProvider value={world}>
      <InputProvider value={input}>
        <App />
      </InputProvider>
    </PhysicsProvider>
  </StrictMode>,
)
