import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    alias: {
      $shared: 'src/lib/shared',
      $habits: 'src/lib/domains/habits',
      $styles: 'src/styles'
    }
  }
};

export default config;
