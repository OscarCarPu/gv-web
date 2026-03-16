import { describe, it, expect } from 'vitest';
import { LoginResponseSchema, Verify2FAResponseSchema } from '$lib/domains/auth/schemas/auth.schemas';

describe('auth schemas', () => {
	it('LoginResponseSchema parses valid token', () => {
		const result = LoginResponseSchema.parse({ token: 'abc123' });
		expect(result).toEqual({ token: 'abc123' });
	});

	it('Verify2FAResponseSchema parses valid token', () => {
		const result = Verify2FAResponseSchema.parse({ token: 'xyz789' });
		expect(result).toEqual({ token: 'xyz789' });
	});
});
