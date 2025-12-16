import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    alias: {
      $domains: 'src/lib/domains',
      $shared: 'src/lib/shared'
    }
  }
};

export default config;
