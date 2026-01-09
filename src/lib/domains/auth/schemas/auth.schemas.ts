import { z } from 'zod';

export const LoginResponseSchema = z.object({
  temp_token: z.string()
});

export const Verify2FAResponseSchema = z.object({
  access_token: z.string()
});
