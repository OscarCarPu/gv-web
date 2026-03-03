import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    alias: {
      $shared: 'src/lib/shared',
      $habits: 'src/lib/domains/habits',
      $auth: 'src/lib/domains/auth',
      $styles: 'src/styles'
    }
  }
};

export default config;
