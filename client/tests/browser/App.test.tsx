import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import App from '../../src/App';

test('renders the get started heading', async () => {
  const screen = await render(<App />);
  await expect.element(screen.getByRole('heading', { name: 'Get started' })).toBeVisible();
});
