import { writable } from 'svelte/store';
import { browser } from '$app/environment';

function createAuthStore() {
  const { subscribe, set } = writable<string | undefined>(undefined);

  return {
    subscribe,
    setToken: (token: string | undefined) => set(token),
    clear: () => set(undefined)
  };
}

export const authStore = createAuthStore();

let currentToken: string | undefined;

authStore.subscribe((token) => {
  currentToken = token;
});

// For server-side, we need a way to temporarily set the token
let serverToken: string | undefined;

export function setServerToken(token: string | undefined) {
  serverToken = token;
}

export function getToken(): string | undefined {
  // On server, use serverToken; on client, use store token
  return browser ? currentToken : serverToken;
}
