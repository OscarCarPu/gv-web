import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default [
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
	},
	{
		// .svelte.ts rune modules go through svelte-eslint-parser too, and it needs
		// the TS parser handed to it or every `import type` is a syntax error.
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser,
			},
		},
	},
	{
		rules: {
			// No `base` path is configured, so resolve() would only wrap every href
			// and goto() in a call that hands back the string it was given.
			'svelte/no-navigation-without-resolve': 'off',
			// Flags every `new Date(x).toISOString()` and every Map built inside a
			// $derived. Those are throwaway values, not state anything renders from.
			'svelte/prefer-svelte-reactivity': 'off',
		},
	},
	{
		// Descriptions render through linkify(), which is what produces the anchor
		// tags; the input is the user's own text on a single-user app.
		files: ['src/lib/domains/tasks/components/*.svelte', 'src/routes/tasks/+page.svelte'],
		rules: { 'svelte/no-at-html-tags': 'off' },
	},
	{
		// LayerCake hands its scales and accessors over getContext untyped.
		files: ['src/lib/shared/components/chart/*.svelte'],
		rules: { '@typescript-eslint/no-explicit-any': 'off' },
	},
	{
		ignores: ['build/', '.svelte-kit/', 'dist/'],
	},
];
