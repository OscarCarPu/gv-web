// Server-only printer registry. Secrets (API keys) live here and never reach the client.
// Values come from env so deployments can override without code changes.

export type Printer = {
	id: string;
	name: string;
	model: string;
	rtsp: string;
	prusaLinkHost?: string;
	// PrusaLink auth: Buddy firmware uses HTTP Digest (user + password). An API key
	// is supported as an alternative when set.
	prusaLinkUser?: string;
	prusaLinkPassword?: string;
	prusaLinkApiKey?: string;
	// Target storage for uploads ('usb' on Buddy firmware, 'local' on a PrusaLink Pi).
	// Left unset it is auto-detected from GET /api/v1/storage.
	prusaLinkStorage?: string;
};

const PRINTERS: Printer[] = [
	{
		id: 'core-one',
		name: 'Prusa CORE One',
		model: 'Prusa CORE One + Buddy3D',
		rtsp: process.env.PRINTER_RTSP_URL || 'rtsp://192.168.1.211/live',
		prusaLinkHost: process.env.PRUSALINK_HOST || undefined,
		prusaLinkUser: process.env.PRUSALINK_USER || undefined,
		prusaLinkPassword: process.env.PRUSALINK_PASSWORD || undefined,
		prusaLinkApiKey: process.env.PRUSALINK_API_KEY || undefined,
		prusaLinkStorage: process.env.PRUSALINK_STORAGE || undefined,
	},
];

/** Public list (no secrets) safe to send to the browser. */
export function listPrinters() {
	return PRINTERS.map(({ id, name, model }) => ({ id, name, model }));
}

export function getPrinter(id: string): Printer | undefined {
	return PRINTERS.find((p) => p.id === id);
}
