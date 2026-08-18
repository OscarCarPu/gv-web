import type { RGB } from './api/lights.schemas';

export function toHex({ r, g, b }: RGB): string {
	const channel = (v: number) =>
		Math.round(Math.min(255, Math.max(0, v)))
			.toString(16)
			.padStart(2, '0');
	return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function fromHex(hex: string): RGB {
	const clean = hex.replace('#', '');
	return {
		r: parseInt(clean.slice(0, 2), 16),
		g: parseInt(clean.slice(2, 4), 16),
		b: parseInt(clean.slice(4, 6), 16),
	};
}

/**
 * Approximate sRGB for a colour temperature — used to preview white mode on the card.
 * Tanner Helland's piecewise fit; accurate enough for a glow, and it avoids asking the
 * bulb what its whites actually look like.
 */
function kelvinToRgb(kelvin: number): RGB {
	const t = Math.min(40000, Math.max(1000, kelvin)) / 100;

	let r: number;
	let g: number;
	let b: number;

	if (t <= 66) {
		r = 255;
		g = 99.4708025861 * Math.log(t) - 161.1195681661;
	} else {
		r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
		g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
	}

	if (t >= 66) {
		b = 255;
	} else if (t <= 19) {
		b = 0;
	} else {
		b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
	}

	const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
	return { r: clamp(r), g: clamp(g), b: clamp(b) };
}

/** Colour a card should glow with, given its mode. */
export function glowColor(state: { mode: 'color' | 'white'; color: RGB; colorTemp: number }): RGB {
	return state.mode === 'white' ? kelvinToRgb(state.colorTemp) : state.color;
}

export function toCss(rgb: RGB): string {
	return `rgb(${Math.round(rgb.r)} ${Math.round(rgb.g)} ${Math.round(rgb.b)})`;
}

/** Named presets for the swatch row. */
export const PRESETS: { name: string; color: RGB }[] = [
	{ name: 'Warm white', color: { r: 255, g: 197, b: 143 } },
	{ name: 'Daylight', color: { r: 255, g: 255, b: 251 } },
	{ name: 'Red', color: { r: 255, g: 59, b: 48 } },
	{ name: 'Orange', color: { r: 255, g: 149, b: 0 } },
	{ name: 'Green', color: { r: 52, g: 199, b: 89 } },
	{ name: 'Cyan', color: { r: 50, g: 214, b: 229 } },
	{ name: 'Blue', color: { r: 0, g: 122, b: 255 } },
	{ name: 'Purple', color: { r: 175, g: 82, b: 222 } },
	{ name: 'Pink', color: { r: 255, g: 45, b: 146 } },
];
