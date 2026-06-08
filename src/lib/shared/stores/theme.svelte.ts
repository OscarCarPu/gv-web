type Theme = 'light' | 'dark';

let theme = $state<Theme>('dark');

/** Sync the store with the theme already applied to <html> by the app.html init script. */
export function initTheme() {
	const current = document.documentElement.dataset.theme as Theme | undefined;
	theme = current === 'light' ? 'light' : 'dark';
}

export function getTheme(): Theme {
	return theme;
}

export function toggleTheme() {
	theme = theme === 'dark' ? 'light' : 'dark';
	document.documentElement.dataset.theme = theme;
	try {
		localStorage.setItem('theme', theme);
	} catch {
		// ignore unavailable storage (private mode / disabled)
	}
}
