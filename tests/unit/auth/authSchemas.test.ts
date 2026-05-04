import { describe, it, expect } from 'vitest';
import { LoginResponseSchema, Verify2FAResponseSchema } from '$lib/domains/auth/schemas/auth.schemas';

describe('auth schemas', () => {
	it('LoginResponseSchema parses tmp kind', () => {
		const result = LoginResponseSchema.parse({ token: 'abc123', kind: 'tmp' });
		expect(result).toEqual({ token: 'abc123', kind: 'tmp' });
	});

	it('LoginResponseSchema parses semi kind', () => {
		const result = LoginResponseSchema.parse({ token: 'abc123', kind: 'semi' });
		expect(result).toEqual({ token: 'abc123', kind: 'semi' });
	});

	it('LoginResponseSchema rejects invalid kind', () => {
		expect(() => LoginResponseSchema.parse({ token: 'abc123', kind: 'other' })).toThrow();
	});

	it('Verify2FAResponseSchema parses valid token', () => {
		const result = Verify2FAResponseSchema.parse({ token: 'xyz789' });
		expect(result).toEqual({ token: 'xyz789' });
	});
});
