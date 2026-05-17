import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  plugins: [react()],
  test: {
    passWithNoTests: true,
    projects: [
      {
        plugins: [react()],
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
          environment: 'node',
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'browser',
          include: ['tests/browser/**/*.{test,spec}.{ts,tsx}'],
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            headless: true,
          },
        },
      },
    ],
  },
});
