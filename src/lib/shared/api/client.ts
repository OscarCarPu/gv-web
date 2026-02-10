import { z } from 'zod';
import { env } from '$lib/config/env';

export async function fetchAPI<T>(
  endpoint: string,
  schema: z.ZodType<T>,
  options?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>)
  };

  const response = await fetch(`${env.API_URL}${endpoint}`, {
    ...options,
    headers
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
