/**
 * PrimeX CRM — Backend API Client
 *
 * All API calls go through this module to the FastAPI backend on Render.
 * The NEXT_PUBLIC_BACKEND_URL env var controls the backend URL.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
export const API_BASE = `${BACKEND_URL}/api/v1`;

/** Get stored access token from localStorage */
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

/** Standard headers with Bearer token */
export function authHeaders(): HeadersInit {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Generic API fetcher — throws on non-2xx */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/** GET helper */
export const apiGet = <T>(path: string) => apiFetch<T>(path);

/** POST helper */
export const apiPost = <T>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) });

/** PATCH helper */
export const apiPatch = <T>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) });

/** DELETE helper */
export const apiDelete = <T>(path: string) =>
  apiFetch<T>(path, { method: "DELETE" });
