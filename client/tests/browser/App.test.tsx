import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import App from '../../src/App'

test('mounts a WebGL canvas for the scene', async () => {
  const screen = await render(<App />)
  const canvas = screen.container.querySelector('canvas')
  await expect.poll(() => canvas).not.toBeNull()
  expect(canvas).toBeInstanceOf(HTMLCanvasElement)
})
