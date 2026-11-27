/**
 * Client-side auth token for Authorization header.
 * Used when cookie is not sent (e.g. cross-origin). Server accepts either
 * cookie or Bearer token.
 */

const AUTH_TOKEN_KEY = "authToken";

export function setAuthToken(token: string): void {
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

export function getAuthToken(): string | null {
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

/** Headers to add to authenticated API requests (Bearer token). */
export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
