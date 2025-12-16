import { z } from 'zod';
import { env } from '$lib/config/env';

export async function fetchAPI<T>(
  endpoint: string,
  schema: z.ZodType<T>,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${env.API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': env.API_KEY,
      ...options?.headers
    },
    ...options
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.detail || `API Error: ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  if (response.status === 204 || schema instanceof z.ZodVoid) {
    return undefined as T;
  }

  const data = await response.json();
  return schema.parse(data);
}
