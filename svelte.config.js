import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const web_url = process.env.WEB_URL || 'http://localhost:5173';

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
  },
  csrf: {
    trustedOrigins: [web_url]
  }
};

export default config;
