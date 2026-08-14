import { describe, it, expect } from 'vitest';
import {
	firstErrorLine,
	parseRange,
	parseRecordingName,
	recordingName,
	recordingPath,
} from '$lib/server/domotics/printers/recordings';
import { formatBytes, formatClock } from '$lib/domains/domotics/printers/format';

describe('recordingName / parseRecordingName', () => {
	it('round-trips a UTC instant through the file name', () => {
		const at = new Date('2026-08-06T14:32:05.000Z');
		const name = recordingName(at);
		expect(name).toBe('2026-08-06T14-32-05.mp4');
		expect(parseRecordingName(name)?.toISOString()).toBe(at.toISOString());
	});

	it('drops sub-second precision so the name is a stable key', () => {
		expect(recordingName(new Date('2026-08-06T14:32:05.987Z'))).toBe('2026-08-06T14-32-05.mp4');
	});

	it('accepts the poster that sits next to a recording', () => {
		expect(parseRecordingName('2026-08-06T14-32-05.jpg')).not.toBeNull();
	});

	// This is the security boundary: the name lands in a filesystem path, so anything that is
	// not a timestamp we generated must be rejected outright.
	it('rejects traversal and anything else that is not one of our names', () => {
		for (const bad of [
			'../../../etc/passwd',
			'..%2f2026-08-06T14-32-05.mp4',
			'/etc/passwd',
			'2026-08-06T14-32-05.mp4/../../secret',
			'2026-08-06T14-32-05.sh',
			'2026-08-06T14-32-05',
			'26-08-06T14-32-05.mp4',
			'2026-08-06 14:32:05.mp4',
			'.mp4',
			'',
		]) {
			expect(parseRecordingName(bad), bad).toBeNull();
			expect(recordingPath('core-one', bad), bad).toBeNull();
		}
	});

	it('builds a path inside the printer folder for a valid name', () => {
		expect(recordingPath('core-one', '2026-08-06T14-32-05.mp4')).toContain(
			'core-one/2026-08-06T14-32-05.mp4'
		);
	});
});

describe('parseRange', () => {
	it('parses a closed range', () => {
		expect(parseRange('bytes=0-499', 1000)).toEqual({ start: 0, end: 499 });
	});

	it('parses an open-ended range as the rest of the file', () => {
		expect(parseRange('bytes=500-', 1000)).toEqual({ start: 500, end: 999 });
	});

	it('parses a suffix range as the final N bytes', () => {
		expect(parseRange('bytes=-200', 1000)).toEqual({ start: 800, end: 999 });
	});

	it('clamps an end past the file to the last byte', () => {
		expect(parseRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 });
	});

	// Nothing usable to honour — the route serves the whole file instead of erroring.
	it('returns null for absent, malformed or unsatisfiable ranges', () => {
		expect(parseRange(null, 1000)).toBeNull();
		expect(parseRange('bytes=', 1000)).toBeNull();
		expect(parseRange('items=0-10', 1000)).toBeNull();
		expect(parseRange('bytes=0-10, 20-30', 1000)).toBeNull(); // multi-range, not supported
		expect(parseRange('bytes=1000-', 1000)).toBeNull(); // start past the end
		expect(parseRange('bytes=500-100', 1000)).toBeNull(); // end before start
		expect(parseRange('bytes=0-499', 0)).toBeNull(); // empty file
	});
});

describe('firstErrorLine', () => {
	it('picks the last meaningful line of an ffmpeg dump', () => {
		const stderr = '\n[rtsp @ 0x1] method DESCRIBE failed\nrtsp://cam: Connection refused\n\n';
		expect(firstErrorLine(stderr)).toBe('rtsp://cam: Connection refused');
	});

	it('is null when ffmpeg said nothing', () => {
		expect(firstErrorLine('   \n\n')).toBeNull();
	});
});

describe('formatBytes', () => {
	it('steps one unit at a time', () => {
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(1024 * 800)).toBe('800 KB');
		expect(formatBytes(1024 * 1024 * 4.15)).toBe('4.2 MB');
		expect(formatBytes(1024 ** 3 * 1.2)).toBe('1.20 GB');
	});

	it('shows a dash for an unknown size', () => {
		expect(formatBytes(undefined)).toBe('—');
	});
});

describe('formatClock', () => {
	it('drops the hour segment under an hour', () => {
		expect(formatClock(0)).toBe('00:00');
		expect(formatClock(9_000)).toBe('00:09');
		expect(formatClock(271_000)).toBe('04:31');
	});

	it('keeps it past an hour', () => {
		expect(formatClock(4_325_000)).toBe('1:12:05');
	});

	it('never goes negative when clocks disagree', () => {
		expect(formatClock(-5_000)).toBe('00:00');
	});
});
