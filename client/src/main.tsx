import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { PhysicsProvider } from './physics/PhysicsContext'
import { createPhysicsWorld } from './physics/world'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found in index.html')
}

const world = await createPhysicsWorld()

createRoot(rootElement).render(
  <StrictMode>
    <PhysicsProvider value={world}>
      <App />
    </PhysicsProvider>
  </StrictMode>,
)
