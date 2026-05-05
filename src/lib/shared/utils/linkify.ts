import { addToast } from '$shared/stores/toast.svelte';

const URL_RE = /((https?|file):\/\/[^\s<>"]*[^\s<>".,;:!?)])/g;

function escapeAttr(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function escapeText(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function shortLabel(url: string): string {
	try {
		const { hostname, pathname, protocol } = new URL(url);
		const path = pathname.replace(/\/$/, '');
		const last = path.split('/').filter(Boolean).pop();
		if (protocol === 'file:') {
			return last ? `…/${decodeURIComponent(last)}` : url;
		}
		if (last) {
			return hostname
				? `${hostname}/…/${decodeURIComponent(last)}`
				: `…/${decodeURIComponent(last)}`;
		}
		return hostname || url;
	} catch {
		return url;
	}
}

function encodeUrl(raw: string): string {
	try {
		return new URL(raw).href;
	} catch {
		return raw.replace(/ /g, '%20');
	}
}

const linkifyCache = new Map<string, string>();
const LINKIFY_CACHE_LIMIT = 500;

export function linkify(text: string): string {
	const cached = linkifyCache.get(text);
	if (cached !== undefined) return cached;
	const out = text.replace(URL_RE, (url) => {
		const isFile = url.startsWith('file://');
		const href = encodeUrl(url);
		const label = shortLabel(url);
		const cls = isFile ? 'linkify-link linkify-file' : 'linkify-link';
		const dataAttr = isFile ? ` data-file-url="${escapeAttr(url)}"` : '';
		return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer" class="${cls}" title="${escapeAttr(url)}"${dataAttr}>${escapeText(label)}</a>`;
	});
	if (linkifyCache.size >= LINKIFY_CACHE_LIMIT) linkifyCache.clear();
	linkifyCache.set(text, out);
	return out;
}

let listenerInstalled = false;

export function installLinkifyHandler(): void {
	if (listenerInstalled || typeof document === 'undefined') return;
	listenerInstalled = true;
	document.addEventListener(
		'click',
		(e) => {
			const target = e.target as HTMLElement | null;
			const anchor = target?.closest('a.linkify-file') as HTMLAnchorElement | null;
			if (!anchor) return;
			const url = anchor.dataset.fileUrl;
			if (!url) return;
			e.preventDefault();
			navigator.clipboard
				.writeText(url)
				.then(() => addToast('Ruta copiada al portapapeles', 'success'))
				.catch(() => addToast('No se pudo copiar la ruta', 'error'));
		},
		true,
	);
}
