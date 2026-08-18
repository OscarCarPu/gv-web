import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],

	resolve: {
		conditions: ['browser'],
	},

	// TZ is pinned in the test:unit script, not here: the DST tests need a zone
	// that actually shifts, and setting it at runtime does not take under bun.
	test: {
		include: ['tests/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./tests/setup.ts'],
	},

	build: {
		target: 'esnext',
		minify: 'esbuild',
		cssMinify: 'lightningcss',
	},
});
