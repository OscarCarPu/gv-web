const URL_RE = /((https?|file):\/\/[^\s<>"]*[^\s<>".,;:!?)])/g;

function shortLabel(url: string): string {
	try {
		const { hostname, pathname } = new URL(url);
		const path = pathname.replace(/\/$/, '');
		const last = path.split('/').filter(Boolean).pop();
		if (last) {
			const decoded = decodeURIComponent(last);
			return hostname ? `${hostname}/…/${decoded}` : `…/${decoded}`;
		}
		return hostname || url;
	} catch {
		return url;
	}
}

function encodeUrl(raw: string): string {
	try {
		// Parse then re-serialize to let URL normalize it; encode spaces not already encoded
		const u = new URL(raw);
		return u.href;
	} catch {
		return raw.replace(/ /g, '%20');
	}
}

export function linkify(text: string): string {
	return text.replace(URL_RE, (url) => {
		const href = encodeUrl(url);
		return `<a href="${href}" target="_blank" rel="noopener noreferrer" title="${url}">${shortLabel(url)}</a>`;
	});
}
