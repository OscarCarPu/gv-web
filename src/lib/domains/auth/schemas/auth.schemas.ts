import * as z from 'zod';

export const LoginResponseSchema = z.object({
  token: z.string()
});

export const Verify2FAResponseSchema = z.object({
  token: z.string()
});
