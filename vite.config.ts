import { sveltekit } from '@sveltejs/kit/vite';
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
      reporter: ['text', 'json', 'json-summary', 'html'],
      include: ['src/lib/**/*.ts'],
      exclude: ['tests/**', '**/*.config.*', '**/*.d.ts']
    }
  },

  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: 'lightningcss'
  }
});
