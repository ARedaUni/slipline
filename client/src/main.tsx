import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { InputProvider } from './input/InputContext'
import { createKeyboard } from './input/keyboard'
import { createMouse } from './input/mouse'
import { PhysicsProvider } from './physics/PhysicsContext'
import { createPhysicsWorld } from './physics/world'
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
