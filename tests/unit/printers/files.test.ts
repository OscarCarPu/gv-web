import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
	sanitizeFileName,
	filePath,
	pickStorage,
	bodySizeLimitError,
} from '$lib/server/printers/files';
import { digestHeader, parseChallenge } from '$lib/server/printers/prusalink';
import { hasAcceptedExtension } from '$lib/domains/printers/printerFiles.svelte';

const md5 = (s: string) => createHash('md5').update(s).digest('hex');

describe('sanitizeFileName', () => {
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
		for (const name of ['a.bgcode', 'a.gcode', 'a.gco', 'a.g', 'a.GCODE']) {
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
