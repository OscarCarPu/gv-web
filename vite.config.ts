import { sveltekit } from '@sveltejs/kit/vite';
// @ts-expect-error - tailwindcss/vite types not fully compatible
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    sveltekit(),
    tailwindcss()
  ],

  resolve: {
    conditions: ['browser']
  },

  test: {
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['tests/e2e/**'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['tests/**', '**/*.config.*']
    }
  },

  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: 'lightningcss'
  }
});
