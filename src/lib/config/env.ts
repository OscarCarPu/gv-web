const DEFAULT_API_URL = 'http://localhost:8080';

export const env = {
  API_URL: import.meta.env.VITE_API_URL || DEFAULT_API_URL,
  SERVER_API_URL: import.meta.env.SSR
    ? (process.env.API_URL || DEFAULT_API_URL)
    : (import.meta.env.VITE_API_URL || DEFAULT_API_URL),
};
