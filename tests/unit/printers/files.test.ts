import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
	sanitizeFileName,
	filePath,
	pickStorage,
	bodySizeLimitError,
	uploadTimeoutMs,
} from '$lib/server/printers/files';
import { digestHeader, parseChallenge } from '$lib/server/printers/prusalink';
import {
	hasAcceptedExtension,
	uploadErrorMessage,
} from '$lib/domains/printers/printerFiles.svelte';

const md5 = (s: string) => createHash('md5').update(s).digest('hex');

describe('sanitizeFileName', () => {
	// FAT32 short names are what the printer actually reports and what print/delete address.
	it('accepts the 8.3 short names the firmware reports', () => {
		expect(sanitizeFileName('LIGHTH~1.BGC')).toBe('LIGHTH~1.BGC');
		expect(sanitizeFileName('ROBO_A~1.BGC')).toBe('ROBO_A~1.BGC');
		expect(sanitizeFileName('ESCARI~1.GCO')).toBe('ESCARI~1.GCO');
		expect(sanitizeFileName('PUNTEI~1.GCO')).toBe('PUNTEI~1.GCO');
	});

	it('accepts the printable extensions', () => {
		expect(sanitizeFileName('Benchy.bgcode')).toBe('Benchy.bgcode');
		expect(sanitizeFileName('part_v2.gcode')).toBe('part_v2.gcode');
		expect(sanitizeFileName('bracket.GCODE')).toBe('bracket.GCODE');
		expect(sanitizeFileName('old.gco')).toBe('old.gco');
		expect(sanitizeFileName('tiny.g')).toBe('tiny.g');
	});

	it('keeps non-ASCII names intact', () => {
		expect(sanitizeFileName('piña_ñandú.bgcode')).toBe('piña_ñandú.bgcode');
	});

	it('trims surrounding whitespace', () => {
		expect(sanitizeFileName('  spaced.gcode  ')).toBe('spaced.gcode');
	});

	// The whole point of the function: none of these may reach the upstream URL path.
	it('strips directory components rather than trusting them', () => {
		expect(sanitizeFileName('a/b.gcode')).toBe('b.gcode');
		expect(sanitizeFileName('/abs/path/to/x.bgcode')).toBe('x.bgcode');
		expect(sanitizeFileName('windows\\style\\y.gcode')).toBe('y.gcode');
	});

	it('rejects traversal attempts', () => {
		expect(sanitizeFileName('../../etc/passwd')).toBeNull();
		expect(sanitizeFileName('..')).toBeNull();
		expect(sanitizeFileName('.')).toBeNull();
		// A traversal segment that would otherwise survive as a dotfile basename.
		expect(sanitizeFileName('../.gcode')).toBeNull();
	});

	it('rejects empty, over-long and non-printable names', () => {
		expect(sanitizeFileName('')).toBeNull();
		expect(sanitizeFileName('   ')).toBeNull();
		expect(sanitizeFileName(`${'a'.repeat(260)}.gcode`)).toBeNull();
		expect(sanitizeFileName('bad\u0000name.gcode')).toBeNull();
		expect(sanitizeFileName('bad\nname.gcode')).toBeNull();
		expect(sanitizeFileName('bad\u007fname.gcode')).toBeNull();
	});

	it('rejects extensions the printer cannot print', () => {
		expect(sanitizeFileName('model.stl')).toBeNull();
		expect(sanitizeFileName('sketch.3mf')).toBeNull();
		expect(sanitizeFileName('firmware.bbf')).toBeNull();
		expect(sanitizeFileName('noextension')).toBeNull();
		expect(sanitizeFileName('trailing.gcode.zip')).toBeNull();
	});

	it('agrees with the client-side pre-check', () => {
		for (const name of ['a.bgcode', 'a.gcode', 'a.bgc', 'a.gco', 'a.g', 'a.GCODE']) {
			expect(hasAcceptedExtension(name)).toBe(true);
			expect(sanitizeFileName(name)).not.toBeNull();
		}
		for (const name of ['a.stl', 'a.3mf', 'a']) {
			expect(hasAcceptedExtension(name)).toBe(false);
			expect(sanitizeFileName(name)).toBeNull();
		}
	});
});

describe('filePath', () => {
	it('encodes the name but not the storage separator', () => {
		expect(filePath('usb', 'plain.gcode')).toBe('/api/v1/files/usb/plain.gcode');
		expect(filePath('usb', 'with space.gcode')).toBe('/api/v1/files/usb/with%20space.gcode');
		expect(filePath('usb', 'hash#1.gcode')).toBe('/api/v1/files/usb/hash%231.gcode');
		expect(filePath('usb', 'a+b&c.gcode')).toBe('/api/v1/files/usb/a%2Bb%26c.gcode');
	});
});

describe('pickStorage', () => {
	const usb = {
		name: 'USB',
		type: 'USB',
		path: '/usb',
		available: true,
		read_only: false,
	};

	it('honours an explicit override and normalizes its slashes', () => {
		expect(pickStorage([usb], 'local')).toBe('local');
		expect(pickStorage([usb], '/local/')).toBe('local');
	});

	it('picks the first usable storage', () => {
		expect(pickStorage([usb])).toBe('usb');
		expect(
			pickStorage([
				{ ...usb, path: '/sdcard', available: false },
				{ ...usb, path: '/local', read_only: true },
				{ ...usb, path: '/usb' },
			])
		).toBe('usb');
	});

	it('falls back to usb when nothing is usable', () => {
		expect(pickStorage([])).toBe('usb');
		expect(pickStorage(undefined)).toBe('usb');
		expect(pickStorage([{ ...usb, available: false }])).toBe('usb');
		expect(pickStorage([{ ...usb, path: '/local', read_only: true }])).toBe('usb');
	});
});

describe('digest auth for writes', () => {
	// Buddy firmware's challenge carries no qop, which is why gv-web can reuse a nonce and
	// therefore send an upload body exactly once.
	const challengeHeader = 'Digest realm="Printer API", nonce="abc123", algorithm=MD5';

	it('parses the challenge', () => {
		expect(parseChallenge(challengeHeader)).toEqual({
			realm: 'Printer API',
			nonce: 'abc123',
			algorithm: 'MD5',
		});
	});

	it('computes MD5(HA1:nonce:HA2) for a PUT, with no nc/cnonce', () => {
		const uri = '/api/v1/files/usb/Benchy.bgcode';
		const header = digestHeader('maker', 'secret', 'PUT', uri, parseChallenge(challengeHeader));

		const ha1 = md5('maker:Printer API:secret');
		const ha2 = md5(`PUT:${uri}`);
		const expected = md5(`${ha1}:abc123:${ha2}`);

		expect(header).toContain(`response="${expected}"`);
		expect(header).toContain('username="maker"');
		expect(header).toContain(`uri="${uri}"`);
		// No qop in the challenge means these must be absent, not merely unused.
		expect(header).not.toContain('qop=');
		expect(header).not.toContain('nc=');
		expect(header).not.toContain('cnonce=');
	});

	it('binds the response to the method, so a GET digest cannot authorize a PUT', () => {
		const uri = '/api/v1/files/usb/Benchy.bgcode';
		const challenge = parseChallenge(challengeHeader);
		const get = digestHeader('maker', 'secret', 'GET', uri, challenge);
		const put = digestHeader('maker', 'secret', 'PUT', uri, challenge);
		expect(get).not.toEqual(put);
	});

	it('uses the qop form when the challenge advertises one', () => {
		const header = digestHeader(
			'maker',
			'secret',
			'PUT',
			'/api/v1/files/usb/x.gcode',
			parseChallenge('Digest realm="r", nonce="n", qop="auth,auth-int", algorithm=MD5')
		);
		expect(header).toContain('qop=auth');
		expect(header).toContain('nc=00000001');
		expect(header).toMatch(/cnonce="[0-9a-f]{16}"/);
	});
});

describe('bodySizeLimitError', () => {
	// adapter-node's real message, from the production log that produced a bare 500.
	const real = 'Content-length of 65779363 exceeds limit of 524288 bytes.';

	it('turns the adapter message into something actionable', () => {
		expect(bodySizeLimitError(real)).toBe(
			'File is 62.7 MB but the server accepts at most 0.5 MB. Raise BODY_SIZE_LIMIT.'
		);
	});

	it('ignores unrelated errors so they keep their own handling', () => {
		expect(bodySizeLimitError('socket hang up')).toBeNull();
		expect(bodySizeLimitError('')).toBeNull();
		expect(bodySizeLimitError('PrusaLink /api/v1/status -> 401')).toBeNull();
	});
});

describe('uploadErrorMessage', () => {
	it("prefers the app's own JSON error verbatim", () => {
		expect(uploadErrorMessage(409, 'A file with that name is already on the printer')).toBe(
			'A file with that name is already on the printer'
		);
		// Even for a gateway status, a real server message wins.
		expect(uploadErrorMessage(413, 'File is 62.7 MB but the server accepts at most 0.5 MB.')).toBe(
			'File is 62.7 MB but the server accepts at most 0.5 MB.'
		);
	});

	it('explains a cut-off connection instead of showing a bare code', () => {
		for (const status of [504, 524]) {
			const msg = uploadErrorMessage(status);
			expect(msg).toContain('100s');
			// The file reaching the server is not the slow part any more, so the message must not
			// blame the printer transfer.
			expect(msg).not.toContain('printer');
			expect(msg).not.toBe(`Upload failed (${status}).`);
		}
	});

	it('explains the other infrastructure failures', () => {
		expect(uploadErrorMessage(0)).toContain('Connection lost');
		expect(uploadErrorMessage(413)).toContain('BODY_SIZE_LIMIT');
		expect(uploadErrorMessage(502)).toContain('unreachable');
		expect(uploadErrorMessage(504)).toContain('cut off');
		expect(uploadErrorMessage(401)).toContain('session expired');
	});

	it('falls back to the status code for anything unrecognised', () => {
		expect(uploadErrorMessage(418)).toBe('Upload failed (418).');
	});
});

describe('uploadTimeoutMs', () => {
	const MB = 1024 * 1024;

	it('scales at 10s per megabyte', () => {
		expect(uploadTimeoutMs(10 * MB)).toBe(100_000);
		expect(uploadTimeoutMs(50 * MB)).toBe(500_000);
		// The 62.7 MB gcode that a flat 180s cap aborted mid-flight.
		expect(uploadTimeoutMs(65_779_363)).toBe(630_000);
	});

	it('rounds partial megabytes up', () => {
		expect(uploadTimeoutMs(10 * MB + 1)).toBe(110_000);
	});

	it('never drops below a minute, however small the file', () => {
		expect(uploadTimeoutMs(1)).toBe(60_000);
		expect(uploadTimeoutMs(0)).toBe(60_000);
		expect(uploadTimeoutMs(5 * MB)).toBe(60_000);
	});

	it('gives a big file far more room than the old flat 180s cap', () => {
		expect(uploadTimeoutMs(65_779_363)).toBeGreaterThan(180_000);
	});
});
