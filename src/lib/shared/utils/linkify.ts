const URL_RE = /(https?:\/\/[^\s<>"]+)/g;

function shortLabel(url: string): string {
	try {
		const { hostname, pathname } = new URL(url);
		const path = pathname.replace(/\/$/, '');
		const last = path.split('/').filter(Boolean).pop();
		return last ? `${hostname}/…/${last}` : hostname;
	} catch {
		return url;
	}
}

export function linkify(text: string): string {
	return text.replace(
		URL_RE,
		(url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" title="${url}">${shortLabel(url)}</a>`
	);
}
