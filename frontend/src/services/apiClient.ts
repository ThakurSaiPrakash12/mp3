/**
 * apiClient.ts — Shared HTTP client used by all API modules.
 */

const defaultApiBaseUrl =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : 'http://localhost:5000';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl;

interface RequestOptions {
  method?: string;
  body?: unknown;
  requiresAuth?: boolean;
}

export interface ApiError {
  message: string;
  status: number;
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, requiresAuth = true } = options;

  const headers: HeadersInit = { 'Content-Type': 'application/json' };

  if (requiresAuth) {
    const token = localStorage.getItem('auth_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = { method, headers };
  if (body) config.body = JSON.stringify(body);

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    // Try to parse JSON error body from FastAPI, fall back to statusText
    let message = response.statusText || 'Request failed';
    try {
      const json = await response.json();
      if (json?.detail) message = typeof json.detail === 'string' ? json.detail : JSON.stringify(json.detail);
    } catch {
      // ignore parse errors
    }
    const error: ApiError = { message, status: response.status };
    throw error;
  }

  return response.json();
}

export { API_BASE_URL };
