import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],

	resolve: {
		conditions: ['browser'],
	},

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
