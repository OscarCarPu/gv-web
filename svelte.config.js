import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
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
    trustedOrigins: ['http://localhost:5173']
  }
};

export default config;
