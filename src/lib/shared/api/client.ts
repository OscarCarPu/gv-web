import { z } from 'zod';
import { browser } from '$app/environment';
import { env } from '$lib/config/env';

let clientToken: string | undefined;

export function setClientToken(token: string | undefined) {
  clientToken = token;
}

export async function fetchAPI<T>(
  endpoint: string,
  schema: z.ZodType<T>,
  options?: RequestInit & { token?: string }
): Promise<T> {
  const baseUrl = browser ? env.API_URL : env.SERVER_API_URL;
  const token = options?.token || (browser ? clientToken : undefined);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>)
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error || `API Error: ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  if (response.status === 204 || schema instanceof z.ZodVoid) {
    return undefined as T;
  }

  const data = await response.json();
  return schema.parse(data);
}
