/**
 * Shared API helpers.
 * Uses VITE_API_BASE_URL in production (points to Railway),
 * or empty string in dev (Vite proxy handles /api).
 */
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res;
}

export async function apiGet(path) {
  return apiFetch(path);
}

export async function apiPost(path, body) {
  return apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function apiJson(path, options) {
  const res = await apiFetch(path, options);
  return res.json();
}
