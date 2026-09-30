import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ROOT is read when the module loads, so point it at a scratch dir before importing.
let dir: string;
let mod: typeof import('$lib/server/domotics/printers/chunkedUpload');

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), 'gv-chunk-test-'));
	process.env.PRINTER_UPLOADS_DIR = dir;
	mod = await import('$lib/server/domotics/printers/chunkedUpload');
});

afterAll(async () => {
	delete process.env.PRINTER_UPLOADS_DIR;
	await rm(dir, { recursive: true, force: true });
});

const bytes = (...n: number[]) => new Uint8Array(n);

describe('parseByteHeader', () => {
	it('accepts plain non-negative integers only', () => {
		expect(mod.parseByteHeader('0')).toBe(0);
		expect(mod.parseByteHeader('104857600')).toBe(104857600);
		for (const bad of [null, '', '-1', '1.5', '1e3', ' 5', '0x10', '1'.repeat(16)]) {
			expect(mod.parseByteHeader(bad)).toBeNull();
		}
	});
});

describe('appendChunk', () => {
	it('stages chunks in order and reports completion on the last one', async () => {
		const id = 'order-0001';
		expect(await mod.appendChunk(id, 0, 5, bytes(1, 2))).toEqual({ received: 2, complete: false });
		expect(await mod.appendChunk(id, 2, 5, bytes(3, 4, 5))).toEqual({
			received: 5,
			complete: true,
		});
		expect([...(await mod.readAssembled(id))]).toEqual([1, 2, 3, 4, 5]);
		await mod.discardUpload(id);
	});

	it('treats a repeated chunk as already received instead of writing it twice', async () => {
		const id = 'retry-0001';
		await mod.appendChunk(id, 0, 4, bytes(1, 2));
		expect(await mod.appendChunk(id, 0, 4, bytes(1, 2))).toEqual({ received: 2, complete: false });
		await mod.appendChunk(id, 2, 4, bytes(3, 4));
		expect([...(await mod.readAssembled(id))]).toEqual([1, 2, 3, 4]);
		await mod.discardUpload(id);
	});

	it('rejects a gap and says how many bytes it really has', async () => {
		const id = 'gap-00001';
		await mod.appendChunk(id, 0, 6, bytes(1, 2));
		await expect(mod.appendChunk(id, 4, 6, bytes(5, 6))).rejects.toMatchObject({
			status: 409,
			received: 2,
		});
		await mod.discardUpload(id);
	});

	it('rejects malformed chunks', async () => {
		await expect(mod.appendChunk('bad-00001', 0, 0, bytes(1))).rejects.toMatchObject({
			status: 400,
		});
		await expect(mod.appendChunk('bad-00002', 0, 4, bytes())).rejects.toMatchObject({
			status: 400,
		});
		await expect(mod.appendChunk('bad-00003', 3, 4, bytes(1, 2))).rejects.toMatchObject({
			status: 400,
		});
	});

	it('refuses a file over the size ceiling', async () => {
		await expect(
			mod.appendChunk('big-00001', 0, mod.MAX_UPLOAD_BYTES + 1, bytes(1))
		).rejects.toMatchObject({ status: 413 });
	});
});

describe('sweepStaleUploads', () => {
	it('deletes old partial uploads and keeps fresh ones', async () => {
		await mod.appendChunk('stale-0001', 0, 4, bytes(1));
		await mod.appendChunk('fresh-0001', 0, 4, bytes(1));
		const old = new Date(Date.now() - 2 * 60 * 60_000);
		await utimes(join(dir, 'stale-0001.part'), old, old);

		await mod.sweepStaleUploads();

		const left = await readdir(dir);
		expect(left).toContain('fresh-0001.part');
		expect(left).not.toContain('stale-0001.part');
		await mod.discardUpload('fresh-0001');
	});
});
